// Read-only: measures the "bring the animal back" loop from live data.
//
// Usage: node --env-file=.env scripts/loop-metrics.mjs
//
// Every query here is a SELECT; the script never writes. It answers the
// questions the release is judged by (see .claude/BACKLOG.md, "Ölçüm
// noktaları"): does the loop have input, does it deliver, does it close.
// Queries that depend on columns we haven't shipped yet report "N/A"
// instead of failing, so the script keeps working as the schema grows.
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (label, sql) => {
  const r = await client.query(sql);
  console.log(label, JSON.stringify(r.rows));
};

await client.connect();

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
