// Read-only: measures the "bring the animal back" loop from live data.
//
// Usage: node --env-file=.env scripts/loop-metrics.mjs
//
// Nothing here touches stored data: every reported number comes from a
// SELECT, and the only writes are the session-local temp table and
// views set up below, which vanish with the connection. It answers the
// questions the release is judged by (see .claude/BACKLOG.md, "Ölçüm
// noktaları"): does the loop have input, does it deliver, does it close.
// Queries that depend on columns we haven't shipped yet report "N/A"
// instead of failing, so the script keeps working as the schema grows.
import pg from "pg";

// `DIRECT_URL` first, and not interchangeably with `DATABASE_URL`.
//
// `DATABASE_URL` is the pgbouncer endpoint in transaction mode: each
// statement may be handed to a different server connection. The temporary
// views below would then be created on one backend and the queries run on
// another — which does not raise an error, it silently reads the
// unfiltered tables and reports the synthetic clinic as real data. A
// read-only script run by hand has no reason to go through a pooler.
//
// Measured while this was being written: seconds after `npm run db:seed`
// wrote the state clinic through `DIRECT_URL`, the pooled endpoint still
// answered `129 clinics / state clinic absent` for about a minute, then
// caught up. Two endpoints disagreeing about whether a row exists is
// enough on its own to read the numbers from one of them only.
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (label, sql) => {
  const r = await client.query(sql);
  console.log(label, JSON.stringify(r.rows));
};

await client.connect();

// Every timestamp column in this schema is `timestamp without time zone`
// holding a UTC instant, which is what Prisma writes. Comparing one of
// those against `now()` — a `timestamptz` — makes Postgres read the naive
// value in the *session* time zone, so the same query answers differently
// depending on where it is run from. Three hours of drift is enough to put
// a record in the wrong bucket on a boundary day, and nothing about the
// output would look wrong.
//
// Pinning the session removes the class rather than the instance. It was
// found because ux almost filed "reminders go out a day early" from a
// script with this exact shape; the reminders were fine.
await client.query("SET TIME ZONE 'UTC'");

// The state clinic is excluded from every number below, and says so.
//
// `scripts/seed-states.mjs` builds one clinic holding every state a screen
// can be in — a void invoice, a deceased animal, a paid invoice in a
// currency this clinic does not bill in. All of it is synthetic and none
// of it is a measurement of anything. Counted here it would move every
// baseline the team has agreed on, in one command.
//
// Done as temporary views rather than a WHERE on each of the fourteen
// queries below. `pg_temp` comes first in the search path, so every
// unqualified table name from here on reads the filtered version, and a
// query added later is filtered without anyone remembering to. Fourteen
// hand-written conditions would work until the fifteenth query.
//
// The cost, and it will bite somebody: a query that wants to measure the
// state clinic ITSELF returns zero from here on, because it is the one
// clinic these views hide. Whoever comes to ask "are all 27 states still
// there" has to qualify the table — `public.clients`, not `clients` — or
// the answer is a confident, wrong "no".
const STATE_CLINIC_NAME = "HÂL KLİNİĞİ";
const stateClinic = await client.query(
  `SELECT id FROM clinics WHERE name = $1`,
  [STATE_CLINIC_NAME],
);
const excludedId = stateClinic.rows[0]?.id ?? null;

if (excludedId) {
  // The id goes into a temp table rather than into the view definitions.
  // `CREATE VIEW` is a utility statement and takes no bind parameters —
  // the first version passed `$1` and every run died on the first view
  // with "bind message supplies 1 parameters, but prepared statement
  // requires 0". Interpolating the id into the SQL would work and is the
  // obvious repair; a one-row table keeps the value parameterised and, if
  // the seed is ever missing, `NOT IN` over an empty table excludes
  // nothing instead of silently excluding everything the way `<> NULL`
  // would.
  await client.query(`CREATE TEMP TABLE excluded_clinic (id text)`);
  await client.query(`INSERT INTO excluded_clinic (id) VALUES ($1)`, [
    excludedId,
  ]);

  // Every public table carrying `clinicId`, not only the ones read today,
  // so the claim above — that a query added later is filtered — is true.
  const scoped = [
    "appointments", "audit_logs", "clients", "custom_species", "diagnostics",
    "documents", "invoices", "message_logs", "notes", "pets", "prescriptions",
    "reminders", "treatments", "users", "vaccinations", "visits",
  ];
  for (const table of scoped) {
    await client.query(
      `CREATE TEMP VIEW ${table} AS
         SELECT * FROM public.${table}
         WHERE "clinicId" NOT IN (SELECT id FROM pg_temp.excluded_clinic)`,
    );
  }
  // Children without a clinic of their own, reached through their parent.
  // `invoices` here is already the filtered view above.
  await client.query(
    `CREATE TEMP VIEW invoice_lines AS
       SELECT l.* FROM public.invoice_lines l
       JOIN invoices i ON i.id = l."invoiceId"`,
  );
  await client.query(
    `CREATE TEMP VIEW payments AS
       SELECT p.* FROM public.payments p
       JOIN invoices i ON i.id = p."invoiceId"`,
  );
  await client.query(
    `CREATE TEMP VIEW clinics AS
       SELECT * FROM public.clinics
       WHERE id NOT IN (SELECT id FROM pg_temp.excluded_clinic)`,
  );
}

console.log(
  excludedId
    ? `EXCLUDED ["${STATE_CLINIC_NAME}" — synthetic, see scripts/seed-states.mjs]`
    : `EXCLUDED [none — "${STATE_CLINIC_NAME}" not seeded]`,
);

await q(
  "VOLUME",
  `SELECT (SELECT count(*) FROM clinics) clinics,
          (SELECT count(*) FROM pets) pets,
          (SELECT count(*) FROM vaccinations) vaccinations,
          (SELECT count(*) FROM visits) visits,
          (SELECT count(*) FROM appointments) appointments,
          (SELECT count(*) FROM reminders) reminders`,
);

// 1) Vaccination return: doses past their nextDueAt, and whether the same pet
// got the same-named vaccine again (14-day grace before the due date).
await q(
  "VACCINATION_RETURN",
  `SELECT count(*) AS due,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM vaccinations v2
            WHERE v2."petId" = v."petId" AND v2.name = v.name AND v2.id <> v.id
              AND v2."administeredAt" >= v."nextDueAt" - interval '14 days'
          )) AS returned
   FROM vaccinations v
   WHERE v."nextDueAt" IS NOT NULL AND v."nextDueAt" < now()`,
);

// 2) Follow-up return: visits with a past follow-up date, and whether the pet
// came back around or after it (3-day grace).
await q(
  "FOLLOWUP_RETURN",
  `SELECT count(*) AS due,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM visits v2
            WHERE v2."petId" = v."petId" AND v2.id <> v.id
              AND v2."visitedAt" >= v."followupAt" - interval '3 days'
          )) AS returned
   FROM visits v
   WHERE v."followupAt" IS NOT NULL AND v."followupAt" < now()`,
);

await q(
  "PAST_APPOINTMENT_STATUS",
  `SELECT status::text AS status, count(*) AS n FROM appointments
   WHERE "startsAt" < now() GROUP BY 1 ORDER BY 2 DESC`,
);

await q(
  "LOOP_MATERIAL",
  `SELECT (SELECT count(*) FROM vaccinations WHERE "nextDueAt" IS NOT NULL) vacc_with_due,
          (SELECT count(*) FROM visits WHERE "followupAt" IS NOT NULL) visits_with_followup,
          (SELECT count(*) FROM pets WHERE deceased = true) deceased_pets,
          (SELECT count(*) FROM message_logs) messages`,
);

// 3) Reliability of the loop today: reminders that were never delivered.
await q(
  "REMINDER_STATE",
  `SELECT status::text AS status, count(*) AS n FROM reminders GROUP BY 1 ORDER BY 2 DESC`,
);


// --- Milestone sonrası eklenecek ölçümler (alanlar oluşunca çalışır) ---
const optional = async (label, sql) => {
  try { await q(label, sql); } catch (e) { console.log(label, "N/A —", e.message.split("\n")[0]); }
};

// Girdi doluluk oranı: R4a-1'in işe yarayıp yaramadığı buradan okunur.
await optional(
  "INPUT_FILL_RATE",
  `SELECT count(*) FILTER (WHERE "nextDueAt" IS NOT NULL) AS with_due, count(*) AS total
   FROM vaccinations WHERE "administeredAt" > now() - interval '90 days'`,
);

// R4a-1'in kesim tarihi: 7f64494, "Make the next vaccination date the second
// question, and say what it does". Alanın formdaki yeri, sonuç satırı ve
// öneri çipi o commit'le indi.
// Written without a zone suffix on purpose: the column is naive, so a
// trailing "Z" is dropped rather than honoured, and reading it as if it
// meant something would be the kind of decoration that becomes a wrong
// answer the day the session is not UTC. With the session pinned above,
// this is the UTC instant it looks like.
const R4A1_CUTOFF = "2026-09-21 09:02:50";

// Aynı oran, ama yalnızca kesimden SONRA oluşturulan kayıtlarda — ve
// yanında kesimden önceki, artık donmuş küme.
//
// Yukarıdaki INPUT_FILL_RATE'in tek başına cevaplayamadığı soru bu.
// O oran "son 90 gün" penceresinde canlı: payda da pay da her yeni kayıtla
// kayıyor, ve aynı gün içinde üç kez ölçüldüğünde 1/10 → 1/10 → 2/11 okundu.
// Altında kayan bir sayıya karşı "iş işe yaradı mı" sorulamaz.
//
// Daha önemlisi 20 ileriye dönük bir davranışı değiştiriyor: yeni bir kayıt
// oluşturulurken alanın doldurulmasını kolaylaştırıyor, eski kayıtlara
// dokunmuyor. Ömür boyu oran o eski kayıtlarla seyreltilir — yüz eskinin
// yanında on yeni kayıt kusursuz çalışsa bile oran kıpırdamaz ve iş
// "işe yaramadı" görünür. Kesimli ölçü tam da değiştirdiğimiz şeye bakıyor.
//
// `createdAt`, `administeredAt` değil: ölçtüğümüz şey kaydın ne zaman
// girildiği, aşının ne zaman yapıldığı değil. Geriye dönük girilen bir dozun
// uygulama tarihi kesimden önce olabilir; o kayıt yine de yeni formda
// oluşturulmuştur ve bu ölçünün içindedir.
await optional(
  "INPUT_FILL_RATE_SINCE",
  `SELECT '${R4A1_CUTOFF}' AS cutoff,
          count(*) FILTER (WHERE "createdAt" > '${R4A1_CUTOFF}') AS after_total,
          count(*) FILTER (WHERE "createdAt" > '${R4A1_CUTOFF}'
                             AND "nextDueAt" IS NOT NULL) AS after_with_due,
          count(*) FILTER (WHERE "createdAt" <= '${R4A1_CUTOFF}') AS before_total,
          count(*) FILTER (WHERE "createdAt" <= '${R4A1_CUTOFF}'
                             AND "nextDueAt" IS NOT NULL) AS before_with_due
   FROM vaccinations`,
);

// Kapanış nedeni dağılımı: döngünün gerçekten kapandığı yer.
await optional(
  "CLOSURE_REASONS",
  `SELECT "closeReason"::text AS reason, count(*) AS n FROM reminders GROUP BY 1 ORDER BY 2 DESC`,
);

// Gönderim: kanal ve duruma göre. R1'in "bitti" eşiği buradan okunur.
await optional(
  "DELIVERY",
  `SELECT channel::text AS channel, status::text AS status, count(*) AS n
   FROM message_logs GROUP BY 1,2 ORDER BY 3 DESC`,
);

// --- Para döngüsü ölçüleri (sonraki sürümün tabanı) ---
// "Unutulan kalem": fatura başına kalem sayısı ile vizit başına yapılan iş
// sayısı arasındaki fark. Türetme çalıştığında bu fark kapanmalı.
await optional(
  "INVOICE_LINES_PER_INVOICE",
  `SELECT count(DISTINCT i.id) invoices, count(l.id) lines,
          round(count(l.id)::numeric / nullif(count(DISTINCT i.id),0), 2) lines_per_invoice
   FROM invoices i LEFT JOIN invoice_lines l ON l."invoiceId" = i.id`,
);
await optional(
  "WORK_PER_VISIT",
  `SELECT (SELECT count(*) FROM visits) visits,
          (SELECT count(*) FROM treatments) treatments,
          (SELECT count(*) FROM diagnostics) diagnostics`,
);
// Vizit-fatura bağı: InvoiceLine.visitId bugün hiç yazılmıyor.
await optional(
  "LINES_LINKED_TO_VISIT",
  `SELECT count(*) total, count(*) FILTER (WHERE "visitId" IS NOT NULL) linked FROM invoice_lines`,
);
// Fiyat sapması: aynı açıklamanın faturalar arasındaki en düşük/en yüksek fiyatı.
await optional(
  "PRICE_SPREAD",
  `SELECT description, count(*) n, min("unitPriceCents") lo, max("unitPriceCents") hi
   FROM invoice_lines GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC LIMIT 10`,
);

await client.end();
