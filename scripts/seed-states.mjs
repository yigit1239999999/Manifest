// One clinic that contains every state a screen can be in.
//
//   npm run db:seed
//
// Twice in one session a measurement came back "clean" about a state the
// data could not produce: the vet column was never filled, so its narrow
// layout was never wrong; the revenue chart was never full in the clinic
// being looked at, so the sentence under it was never read. Both would
// have reported a pass. A screen cannot be checked against a state that
// does not exist, and "we looked and it was fine" is the most expensive
// wrong answer, because it stops anyone looking again.
//
// Three things this file is built around, each learned the hard way.
//
// 1. The list of states is DATA, not a comment. `STATES` is what the seed
//    promises and `buildStateClinic` reports what it produced; the test
//    compares them. A comment saying "covers 27 states" is true the day it
//    is written and quietly false three states later, which is the shape
//    of half the defects this session was spent on.
//
// 2. It lives in a clinic of its own. Every baseline the team has agreed
//    on is read out of this same database — the frozen 2-of-11 fill rate,
//    the three back-filled visit currencies, the appointment counts.
//    Twenty-seven synthetic records in the working clinic would make all
//    of them incomparable in one command. `loop-metrics.mjs` excludes this
//    clinic and prints that it did, because a silent WHERE is a number
//    nobody can explain six months later.
//
// 3. Idempotent. Run it twice and the clinic is rebuilt, not doubled.
//    Measurements are taken against this database, and a seed that
//    accumulates corrupts the thing it exists to protect.
//
// Raw SQL through `pg`, like `loop-metrics.mjs` beside it, rather than the
// Prisma client: the generated client imports its own modules without file
// extensions, which a bundler resolves and plain Node does not, and adding
// a TypeScript runner to the project to seed a database is a dependency
// bought for one script.

import pg from "pg";

/** The name `loop-metrics.mjs` filters on. Changing it changes both. */
export const STATE_CLINIC_NAME = "HÂL KLİNİĞİ";

/**
 * Every state this clinic exists to hold, ordered by the surface it
 * belongs to rather than the table it lives in — the question being
 * answered is "what can a person see here", not "what rows are there".
 */
export const STATES = [
  // The one that started this: a column never filled, so its narrow-screen
  // behaviour was never wrong.
  { id: "appointment.vet.named", covers: "an appointment with a vet on it" },
  { id: "appointment.vet.none", covers: "an appointment with none" },

  // Five invoice statuses. PARTIAL is the only one needing a chain: an
  // invoice, a line, and a payment smaller than the total.
  { id: "invoice.draft", covers: "an invoice not yet sent" },
  { id: "invoice.sent", covers: "one sent and unpaid" },
  { id: "invoice.partial", covers: "one half collected" },
  { id: "invoice.paid", covers: "one settled" },
  { id: "invoice.void", covers: "one struck out" },

  // The pair that let the dashboard add dollars to lira.
  {
    id: "invoice.paid.ownCurrency",
    covers: "revenue in the clinic's own currency",
  },
  {
    id: "invoice.paid.foreignCurrency",
    covers: "revenue the chart must leave out",
  },

  // Three lives of an animal, three weights of the same page.
  { id: "pet.active", covers: "an animal in ordinary care" },
  {
    id: "pet.archived",
    covers: "one put away, reachable only through the filter",
  },
  { id: "pet.deceased", covers: "one that died: nothing may be sent about it" },

  // Every note kind: the timeline names each from the catalogue, and a
  // kind nobody creates is a label nobody ever reads.
  { id: "note.general", covers: "a plain note" },
  { id: "note.phoneCall", covers: "a phone call" },
  { id: "note.email", covers: "an email" },
  { id: "note.sms", covers: "an SMS" },
  { id: "note.internal", covers: "an internal note" },
  { id: "note.event", covers: "an event" },

  // Length is a state, and both of these have broken a layout before.
  {
    id: "text.longEmail",
    covers: "an address wide enough to push a table sideways",
  },
  {
    id: "text.longTurkishLabel",
    covers: "the longest Turkish text a row can hold",
  },

  // The loop's four resting places.
  { id: "reminder.pending", covers: "a reminder waiting to go" },
  { id: "reminder.sent", covers: "one sent, the animal not yet back" },
  { id: "reminder.acknowledged", covers: "one closed because they came" },
  { id: "reminder.dismissed", covers: "one closed because it was not needed" },

  // Three record types with no data anywhere today, so three screens that
  // have never been measured against anything at all.
  // Consent is three-valued, and one client can only carry one of them.
  // The clinic held a single owner who had agreed, so "refused" and
  // "never asked" existed in the schema and nowhere in the data -- the
  // screen for each was unmeasurable, which is the one thing this clinic
  // is here to prevent. "Agreed" was being produced all along and was not
  // on this list; an unnamed state is an unmeasurable one just as surely.
  {
    id: "client.consent.granted",
    covers:
      "an owner who agreed: messages go out, and the appointment page offers them",
  },
  {
    id: "client.consent.declined",
    covers:
      "an owner who refused: the appointment page says messages will not be sent",
  },
  {
    id: "client.consent.unasked",
    covers: "an owner nobody has asked: the form shows neither answer chosen",
  },

  // The one visible thing the whole scale package produces, and it could
  // not be produced. `/reminders` has 33 clients, the cap is 50, so
  // `hasMore` is false and the note is never rendered -- ux opened the
  // dropdown, counted 33 options and no note, and was looking at correct
  // behaviour. A cut list is a state like any other.
  // A fix that cannot be produced on any screen cannot be accepted. The
  // server now recognises a built-in species by the name a vet types,
  // including one the clinic has switched off -- and no clinic had a
  // built-in switched off on purpose, so there was nowhere to see it.
  {
    id: "species.builtIn.disabled",
    covers:
      "a built-in species the clinic switched off: typing its name still records the built-in, and creates no clinic-defined species",
  },

  {
    id: "client.list.capped",
    covers:
      "more owners than a picker shows: the hint under the list, the two search sentences, and whether onSearch is wired at all past the cap",
  },

  { id: "clinical.prescription", covers: "a prescription on an animal" },
  { id: "clinical.treatment", covers: "a treatment" },
  { id: "clinical.diagnostic", covers: "a diagnostic test" },
];

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY);
const ahead = (days) => new Date(Date.now() + days * DAY);

/**
 * Builds the clinic and returns the ids it actually produced.
 *
 * The return value is the point. The test compares it against `STATES`, so
 * a state declared and not built — or built and not declared — fails here
 * rather than being discovered by someone wondering why a screen still
 * cannot be checked.
 *
 * `db` is anything with `query(sql, params)`, which is what makes the test
 * possible without a database.
 */
export async function buildStateClinic(db) {
  const produced = [];
  const made = (id) => produced.push(id);
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];

  // Rebuilt, not added to; the cascade takes every record with it.
  await db.query(`DELETE FROM clinics WHERE name = $1`, [STATE_CLINIC_NAME]);

  const clinic = await one(
    `INSERT INTO clinics (id, name, currency, timezone, settings, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'TRY', 'Europe/Istanbul', $2::jsonb, now())
     RETURNING id`,
    // RABBIT is left out of the enabled list, and the clinic already has
    // a rabbit. That pairing is the state: an animal that exists as a
    // built-in species the picker no longer offers. Switching a species
    // off governs what is offered, not what exists, and typing "Tavşan"
    // must still record RABBIT rather than inventing a clinic-defined
    // species beside it.
    //
    // Written out rather than derived from DEFAULT_ENABLED_SPECIES. It
    // is not a copy of that list, it is this clinic's choice -- and a
    // choice recorded by inheritance cannot be told from a choice
    // nobody made, which is the same distinction the null consent row
    // above is here to hold.
    [
      STATE_CLINIC_NAME,
      JSON.stringify({
        enabledSpecies: [
          "DOG",
          "CAT",
          "BIRD",
          "RODENT",
          "REPTILE",
          "FISH",
          "EXOTIC",
          "OTHER",
        ],
      }),
    ],
  );
  made("species.builtIn.disabled");

  const vet = await one(
    `INSERT INTO users (id, "clinicId", name, email, "passwordHash", role, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'Hâl Veteriner', $2, 'seed-only-never-a-login',
             'VETERINARIAN', now())
     RETURNING id`,
    // Deliberately long: the staff table and the appointment row both have
    // to survive an address that does not shorten.
    [
      clinic.id,
      "cok.uzun.bir.eposta.adresi.hal@ornek-veteriner-klinigi.example",
    ],
  );
  made("text.longEmail");

  // Three owners, because consent has three values and one row can only
  // hold one of them. Everything else in this clinic hangs off the first;
  // the other two exist to be looked at.
  const owner = async (firstName, lastName, phone, consent) =>
    one(
      `INSERT INTO clients (id, "clinicId", "firstName", "lastName", phone,
                            "notificationsOptIn", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now())
       RETURNING id`,
      [clinic.id, firstName, lastName, phone, consent],
    );

  const client = await owner("Hâl", "Sahibi", "0532 000 00 00", true);
  made("client.consent.granted");
  await owner("Reddeden", "Sahip", "0532 000 00 01", false);
  made("client.consent.declined");
  // `null` and not "leave it out": the column has no default any more
  // (20260921180000), so an omitted value would also be null -- writing
  // it plainly is what says this row is the unasked state on purpose
  // rather than by inheritance.
  await owner("Sorulmamış", "Sahip", "0532 000 00 02", null);
  made("client.consent.unasked");

  // Enough owners to overflow a picker. PAGE_SIZES.DROPDOWN is 50, and
  // 60 rather than 51: at the boundary `hasMore` flips but the part that
  // was cut off is one row, which shows nothing about a vet failing to
  // find somebody. Ten missing rows is a list that visibly stops.
  //
  // Surnames sort after "Sahip" on purpose. The picker orders by surname
  // and the three consent owners above are the ones somebody will come
  // here to look at; put the bulk first and the cap would hide exactly
  // the rows this clinic was extended for last time.
  await db.query(
    `INSERT INTO clients (id, "clinicId", "firstName", "lastName", phone,
                          "notificationsOptIn", "updatedAt")
     SELECT gen_random_uuid()::text, $1, 'Müşteri',
            'Yığın ' || to_char(n, 'FM00'),
            '0533 ' || to_char(n, 'FM000') || ' 00 00',
            NULL, now()
       FROM generate_series(1, 60) AS n`,
    [clinic.id],
  );
  made("client.list.capped");

  const pet = async (name, species, extra = "", params = []) =>
    one(
      `INSERT INTO pets (id, "clinicId", "ownerId", name, species, "updatedAt"${extra ? `, ${extra.split("=")[0]}` : ""})
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Species", now()${extra ? `, $5` : ""})
       RETURNING id`,
      extra
        ? [clinic.id, client.id, name, species, ...params]
        : [clinic.id, client.id, name, species],
    );

  const active = await pet("Etkin", "DOG");
  made("pet.active");
  const archived = await pet("Arşivli", "CAT", '"archivedAt"=', [ago(30)]);
  made("pet.archived");
  const dead = await one(
    `INSERT INTO pets (id, "clinicId", "ownerId", name, species, deceased, "deceasedAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'Vefat', 'RABBIT', true, $3, now())
     RETURNING id`,
    [clinic.id, client.id, ago(60)],
  );
  made("pet.deceased");

  await db.query(
    `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "vetId", "startsAt",
                               type, status, reason, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'WELLNESS_CHECK', 'SCHEDULED',
             'Yıllık kontrol', now())`,
    [clinic.id, active.id, client.id, vet.id, ahead(2)],
  );
  made("appointment.vet.named");

  await db.query(
    `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "startsAt",
                               type, status, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'VACCINATION', 'CONFIRMED', now())`,
    [clinic.id, active.id, client.id, ahead(3)],
  );
  made("appointment.vet.none");

  const visit = await one(
    `INSERT INTO visits (id, "clinicId", "petId", "clientId", "vetId", "visitedAt", type,
                         "chiefComplaint", "totalCents", currency, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'SICK_VISIT', $6, 45000, 'TRY', now())
     RETURNING id`,
    [
      clinic.id,
      active.id,
      client.id,
      vet.id,
      ago(7),
      // The longest Turkish text a row has to hold without pushing its
      // neighbours off a phone.
      "Sağ arka bacakta topallama ve şişlik, iki gündür süren iştahsızlık",
    ],
  );
  made("text.longTurkishLabel");

  await db.query(
    `INSERT INTO prescriptions (id, "clinicId", "petId", "visitId", "medicationName",
                                dosage, frequency, "startedAt", status, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'Amoksisilin', '250 mg',
             'Günde iki kez', $4, 'ACTIVE', now())`,
    [clinic.id, active.id, visit.id, ago(7)],
  );
  made("clinical.prescription");

  await db.query(
    `INSERT INTO treatments (id, "clinicId", "petId", "visitId", name, "performedAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'Yara temizliği ve pansuman', $4, now())`,
    [clinic.id, active.id, visit.id, ago(7)],
  );
  made("clinical.treatment");

  await db.query(
    `INSERT INTO diagnostics (id, "clinicId", "petId", "visitId", type, name,
                              "performedAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'XRAY', 'Sağ arka bacak röntgeni', $4, now())`,
    [clinic.id, active.id, visit.id, ago(7)],
  );
  made("clinical.diagnostic");

  const invoice = async (number, status, currency, cents, paidAt) => {
    const row = await one(
      `INSERT INTO invoices (id, "clinicId", "clientId", number, currency, status,
                             "issuedAt", "paidAt", "subtotalCents", "totalCents", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::"InvoiceStatus", $6, $7, $8, $8, now())
       RETURNING id`,
      [clinic.id, client.id, number, currency, status, ago(20), paidAt, cents],
    );
    await db.query(
      `INSERT INTO invoice_lines (id, "invoiceId", description, quantity,
                                  "unitPriceCents", "totalCents")
       VALUES (gen_random_uuid()::text, $1, 'Muayene', 1, $2, $2)`,
      [row.id, cents],
    );
    return row;
  };

  await invoice("HAL-DRAFT", "DRAFT", "TRY", 20_000, null);
  made("invoice.draft");
  await invoice("HAL-SENT", "SENT", "TRY", 30_000, null);
  made("invoice.sent");
  await invoice("HAL-VOID", "VOID", "TRY", 40_000, null);
  made("invoice.void");

  const pay = async (invoiceId, cents, method, at) =>
    db.query(
      `INSERT INTO payments (id, "invoiceId", "amountCents", method, "paidAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3::"PaymentMethod", $4)`,
      [invoiceId, cents, method, at],
    );

  const partial = await invoice("HAL-PARTIAL", "PARTIAL", "TRY", 50_000, null);
  await pay(partial.id, 20_000, "CASH", ago(10));
  made("invoice.partial");

  const paid = await invoice("HAL-PAID", "PAID", "TRY", 60_000, ago(5));
  await pay(paid.id, 60_000, "CARD", ago(5));
  made("invoice.paid");
  made("invoice.paid.ownCurrency");

  // The clinic bills in lira; this one was issued in dollars and cannot be
  // added to the rest. It is the state that makes the line under the
  // revenue chart appear at all.
  const foreign = await invoice("HAL-PAID-USD", "PAID", "USD", 11_111, ago(5));
  await pay(foreign.id, 11_111, "TRANSFER", ago(5));
  made("invoice.paid.foreignCurrency");

  const NOTES = [
    ["GENERAL", "note.general", "Sahibi telefonla bilgilendirildi."],
    ["PHONE_CALL", "note.phoneCall", "Sahibi arandı, randevu teyit edildi."],
    ["EMAIL", "note.email", "Tahlil sonuçları e-posta ile gönderildi."],
    ["SMS", "note.sms", "Hatırlatma mesajı elle iletildi."],
    ["INTERNAL", "note.internal", "Klinik içi not: ilaç stoğu azaldı."],
    ["EVENT", "note.event", "Hayvan kliniğe kabul edildi."],
  ];
  for (const [kind, id, body] of NOTES) {
    await db.query(
      `INSERT INTO notes (id, "clinicId", "petId", "authorId", kind, body, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"NoteKind", $5, now())`,
      [clinic.id, active.id, vet.id, kind, body],
    );
    made(id);
  }

  const REMINDERS = [
    ["PENDING", "reminder.pending", ahead(7), null],
    ["SENT", "reminder.sent", ago(2), ago(3)],
    ["ACKNOWLEDGED", "reminder.acknowledged", ago(20), ago(21)],
    ["DISMISSED", "reminder.dismissed", ago(30), null],
  ];
  for (const [status, id, dueAt, sentAt] of REMINDERS) {
    await db.query(
      `INSERT INTO reminders (id, "clinicId", "clientId", "petId", type, title,
                              "dueAt", status, "sentAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'CHECKUP', 'Kontrol hatırlatması',
               $4, $5::"ReminderStatus", $6, now())`,
      [clinic.id, client.id, active.id, dueAt, status, sentAt],
    );
    made(id);
  }

  // The archived and deceased animals get a history, so they are pages
  // with something on them rather than rows carrying a flag.
  for (const [petId, when, type] of [
    [archived.id, ago(120), "WELLNESS_CHECK"],
    [dead.id, ago(200), "SICK_VISIT"],
  ]) {
    await db.query(
      `INSERT INTO visits (id, "clinicId", "petId", "clientId", "visitedAt", type, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::"VisitType", now())`,
      [clinic.id, petId, client.id, when, type],
    );
  }

  return produced;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = new pg.Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    const produced = await buildStateClinic(db);
    const missing = STATES.filter((s) => !produced.includes(s.id));
    console.log(
      `${STATE_CLINIC_NAME}: ${produced.length}/${STATES.length} states`,
    );
    if (missing.length > 0) {
      console.error("not produced:", missing.map((s) => s.id).join(", "));
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}
