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

const NO_REAL = "N/A — no real clinics (see POPULATION above)";
// Set once the census below has run. The queries still execute while it
// is true: an empty answer proves nothing about whether the query still
// compiles, and a column renamed under a silent script is how a
// measurement comes back wrong the first day it matters.
let noRealClinics = false;

const q = async (label, sql) => {
  const r = await client.query(sql);
  console.log(label, noRealClinics ? NO_REAL : JSON.stringify(r.rows));
};

/**
 * A metric that is a fraction of something, printed as "N/A" when there
 * is no something.
 *
 * `0/0` and `0 out of 40` look alike in a list and mean opposite things:
 * one is "nobody came back", the other is "nobody was due yet". Read as
 * the first, a measurement that has not started yet reads as a product
 * that is failing, and somebody prioritises against it. The e2e clinics
 * kept these denominators plausible for months; with them filtered out,
 * several are honestly zero.
 *
 * And no percentages here, at any size. The raw pair is what gets
 * printed because "2 of 5" carries its own uncertainty and "40%" throws
 * it away -- a baseline of "18%" was carried around this session on a
 * denominator of 11, most of which turned out to be the test suite
 * signing up.
 */
const ratio = async (label, sql, denominator) => {
  const r = await client.query(sql);
  const empty = r.rows.every((row) => Number(row[denominator]) === 0);
  console.log(
    label,
    noRealClinics
      ? NO_REAL
      : empty
        ? `N/A — no data (${denominator} is zero)`
        : JSON.stringify(r.rows),
  );
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

// Every clinic is classified, the classification is printed, and only
// the ones classified REAL are counted below.
//
// This replaced a filter that removed synthetic clinics and called the
// remainder real. It was not. The database holds 147 clinics: one seeded
// by scripts/seed-states.mjs, 142 left behind by e2e sign-ups, one
// measurement fixture, and three set up by hand while building the
// product. Filtering the first two left "4 clinics, 39 pets", of which
// 32 pets belong to the fixture — a number that looks like a baseline
// and is not one.
//
// Adding a filter for the fixture would have shrunk that number while
// keeping the word "real" on it, and we would have taken the decision
// again for the next kind of clinic. Classifying says the true thing
// instead: REAL is zero. Nobody is using this product yet, so there is
// no loop to measure, and every derived number below is N/A rather than
// bad news.
//
// The day a clinic arrives, REAL becomes 1 by itself and the numbers
// start meaning something. A filter list would have had to be edited
// that day; this does not.
//
// The classification rests on name patterns, which is the same
// fragility as before — but now a break is visible. A clinic that stops
// matching its pattern lands in REAL and the count moves unexpectedly,
// where before it silently joined the population. `Money Clinic <ms>`
// did exactly that and could have hidden for six months; dev-ui's
// e2e/clinic-name.test.ts now holds the e2e end of the same pattern.
//
// Done as temporary views rather than a WHERE on each of the fourteen
// queries below. `pg_temp` comes first in the search path, so every
// unqualified table name from here on reads the filtered version, and a
// query added later is filtered without anyone remembering to. Fourteen
// hand-written conditions would work until the fifteenth query.
//
// The cost, and it will bite somebody: a query that wants to measure a
// non-REAL clinic ITSELF returns zero from here on. Whoever comes to ask
// "are all 32 states still there" has to qualify the table —
// `public.clients`, not `clients` — or the answer is a confident, wrong
// "no".
const STATE_CLINIC_NAME = "HÂL KLİNİĞİ";
// "Clinic 1789996168424" / "Perf Clinic 1789974778229": the e2e sign-up
// helper's name, an epoch in milliseconds. Ten digits or more so that a
// real clinic called "Clinic 3" is never swept up.
const E2E_CLINIC_PATTERN = "^(Perf )?Clinic [0-9]{10,}$";
// Clinics typed in by hand while building the product, named on 21
// September 2026. A list and not a pattern because there is no pattern:
// they were named by people, one at a time. It does not need
// maintaining — anything new falls into REAL, which is the point.
const HAND_MADE = ["PM Test Klinigi", "Yiğit Klinik", "Sunrise"];

const census = await client.query(
  `SELECT id, name,
          CASE
            WHEN name = $1            THEN 'seed'
            WHEN name ~ $2            THEN 'e2e'
            WHEN name LIKE 'PMTEST%'  THEN 'fixture'
            WHEN name = ANY($3::text[]) THEN 'hand-made'
            ELSE 'REAL'
          END AS kind
     FROM clinics`,
  [STATE_CLINIC_NAME, E2E_CLINIC_PATTERN, HAND_MADE],
);

const counts = {};
for (const row of census.rows) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
const real = census.rows.filter((r) => r.kind === "REAL");
const notReal = census.rows.filter((r) => r.kind !== "REAL");

console.log(
  `POPULATION [${["seed", "e2e", "fixture", "hand-made", "REAL"]
    .map((k) => `${k} ${counts[k] ?? 0}`)
    .join(" · ")}] — everything below counts REAL only`,
);

if (notReal.length > 0) {
  // The ids go into a temp table rather than into the view definitions.
  // `CREATE VIEW` is a utility statement and takes no bind parameters —
  // the first version passed `$1` and every run died on the first view
  // with "bind message supplies 1 parameters, but prepared statement
  // requires 0". Interpolating the ids into the SQL would work and is
  // the obvious repair; a table keeps the values parameterised and, if
  // nothing matches, `NOT IN` over an empty table excludes nothing
  // instead of silently excluding everything the way `<> NULL` would.
  await client.query(`CREATE TEMP TABLE excluded_clinic (id text)`);
  await client.query(
    `INSERT INTO excluded_clinic (id) SELECT unnest($1::text[])`,
    [notReal.map((r) => r.id)],
  );

  // Every public table carrying `clinicId`, not only the ones read today,
  // so the claim above — that a query added later is filtered — is true.
  const scoped = [
    "appointments",
    "audit_logs",
    "clients",
    "custom_species",
    "diagnostics",
    "documents",
    "invoices",
    "message_logs",
    "notes",
    "pets",
    "prescriptions",
    "reminders",
    "treatments",
    "users",
    "vaccinations",
    "visits",
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

// With nothing real to measure, every line below would be a zero that
// reads like a finding. "No vaccination came back" and "no vaccination
// exists" are the same distinction `ratio` was written for, one level
// up: here the whole population is missing, not one denominator.
// When the data underneath last changed, read before anything is
// counted.
//
// Three ways exist to check which code is being served and there was
// nothing for the data. A reseed drops every session and changes every
// id without telling anyone: ux lost a measurement to one mid-run and
// read "record not found" as a product defect, because the commit had
// not moved. Whoever measures reads this line before and after, the
// same bracket pm put around the code ground.
//
// Read from the state clinic's own settings rather than a file on
// disk, because a file describes one person's checkout and several
// people share this database. `public.clinics` because the views
// created above hide that clinic by design.
{
  const stamp = await client.query(
    `SELECT settings -> 'seed' AS seed FROM public.clinics WHERE name = $1`,
    [STATE_CLINIC_NAME],
  );
  const seed = stamp.rows[0]?.seed;
  console.log(
    seed?.at
      ? `DATA_GROUND [seeded ${seed.at} · ${seed.states} states]`
      : "DATA_GROUND [unstamped — seed not run since this line was added, or not run at all]",
  );
}

noRealClinics = real.length === 0;
if (noRealClinics) {
  console.log(
    "REAL_POPULATION [none] — no clinic in this database belongs to anyone " +
      "using the product, so every measurement below reads N/A. " +
      "Nothing is failing; nothing has started.",
  );
}

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
await ratio(
  "VACCINATION_RETURN",
  `SELECT count(*) AS due,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM vaccinations v2
            WHERE v2."petId" = v."petId" AND v2.name = v.name AND v2.id <> v.id
              AND v2."administeredAt" >= v."nextDueAt" - interval '14 days'
          )) AS returned
   FROM vaccinations v
   WHERE v."nextDueAt" IS NOT NULL AND v."nextDueAt" < now()`,
  "due",
);

// 2) Follow-up return: visits with a past follow-up date, and whether the pet
// came back around or after it (3-day grace).
await ratio(
  "FOLLOWUP_RETURN",
  `SELECT count(*) AS due,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM visits v2
            WHERE v2."petId" = v."petId" AND v2.id <> v.id
              AND v2."visitedAt" >= v."followupAt" - interval '3 days'
          )) AS returned
   FROM visits v
   WHERE v."followupAt" IS NOT NULL AND v."followupAt" < now()`,
  "due",
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
const optional = async (label, sql, denominator) => {
  try {
    // With a denominator named, the same "no data" rule as `ratio`: a
    // metric whose population is empty must not read as a metric whose
    // answer is zero.
    await (denominator ? ratio(label, sql, denominator) : q(label, sql));
  } catch (e) {
    console.log(label, "N/A —", e.message.split("\n")[0]);
  }
};

// Girdi doluluk oranı: R4a-1'in işe yarayıp yaramadığı buradan okunur.
await optional(
  "INPUT_FILL_RATE",
  `SELECT count(*) FILTER (WHERE "nextDueAt" IS NOT NULL) AS with_due, count(*) AS total
   FROM vaccinations WHERE "administeredAt" > now() - interval '90 days'`,
  "total",
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
  "total",
);
// Fiyat sapması: aynı açıklamanın faturalar arasındaki en düşük/en yüksek fiyatı.
await optional(
  "PRICE_SPREAD",
  `SELECT description, count(*) n, min("unitPriceCents") lo, max("unitPriceCents") hi
   FROM invoice_lines GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC LIMIT 10`,
);

await client.end();
