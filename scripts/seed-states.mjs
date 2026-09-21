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
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** The name `loop-metrics.mjs` filters on. Changing it changes both. */
export const STATE_CLINIC_NAME = "HÂL KLİNİĞİ";

/**
 * The account that can open this clinic and look at it.
 *
 * Every state here is a claim about a screen, and a claim nobody can
 * open is a claim nobody can check. Three times today a measurement
 * stalled because what was needed lived in somebody's head rather than
 * in a file, so this lives in the file and is printed on every run.
 *
 * The vet created below deliberately cannot log in -- its hash is a
 * sentence -- because that row exists to be displayed. This one exists
 * to be used.
 *
 * Not a secret, and it must never become one. It belongs to a clinic
 * this script deletes and rebuilds, every row of which is invented. If
 * this ever runs against a database with real animals in it, the
 * password is the smallest of that day's problems.
 */
export const STATE_CLINIC_LOGIN = {
  email: "hal@ornek-veteriner-klinigi.example",
  password: "hal-klinigi-seed",
};

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
  // pm came here to measure the past-appointment filter and could not:
  // both appointments were in the future. The clinic held the column
  // and not the situation, for the fourth time this session.
  {
    id: "appointment.past.scheduled",
    covers:
      "an appointment whose time has gone by and is still SCHEDULED: nobody came, and nobody wrote that down",
  },
  // ux cannot measure whether a mark is scannable in a list of five.
  // What is being asked is not "is the mark there" but "can the marked
  // ones be picked out from the unmarked", and only a crowd answers
  // that -- so the mix is as much the state as the crowd is.
  {
    id: "appointment.day.busy",
    covers:
      "a full day of appointments, closed and still-open mixed together: whether the outcome-not-recorded mark can be picked out by scanning rather than by reading every row",
  },
  {
    id: "appointment.past.arrived",
    covers:
      "one whose time has gone by and is ARRIVED: they came, and the outcome was never recorded. A different job from the one above, and the status filter shows one at a time",
  },

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

  // The sweep had nothing it could send, in any clinic, so "0 sent" was
  // the only answer it could give and nobody could tell that apart from
  // a sweep that did not work. These three exist to be sent, and the
  // fourth exists to be left alone beside them.
  //
  // Note what one sweep does to them: a sent message blocks the next
  // attempt (`automaticSendBlocked`) and a sent reminder becomes SENT.
  // So they are single-use, and the second run reports `alreadySent`
  // rather than `sent` -- which is correct behaviour and also a state
  // worth seeing. Reseed to get them back.
  {
    id: "notification.appointment.sendable",
    covers:
      "an appointment the sweep can actually send a reminder for: consented owner, living animal, still open, and inside the reminder window",
  },
  {
    id: "notification.appointment.optedOut",
    covers:
      "the same appointment in every respect except consent: whether a screen can tell 'nothing was due' apart from 'the owner said no'",
  },
  {
    id: "notification.reminder.sendable",
    covers:
      "a reminder whose notice is due: the record the vet writes, turned into a message that leaves",
  },

  // Not one FAILED row existed in the whole database, so "could not be
  // sent" was a sentence written four ways and shown zero times. The
  // sweep cannot make one either: the log transport always succeeds.
  // Nothing but the seed can produce this state, which is why it sat
  // unmeasured while three people wrote screens for it.
  //
  // Recency is part of the fixture. The first two hold a failure from
  // an hour ago, which is what keeps them waiting rather than retried;
  // run the sweep more than six hours after seeding and the sweep will
  // try again, succeed against the log transport, and they become
  // "sent". The exhausted one below is permanent.
  {
    id: "notification.reminder.failedClinic",
    covers:
      "a send the operator refused for a reason that is the clinic's: an unapproved sender title fails every message, so whether the screen says it once at the top rather than on every row",
  },
  {
    id: "notification.reminder.failedMessage",
    covers:
      "one refused for a reason that really is about this message: whether the row still carries its own sentence when the cause is not clinic-wide",
  },
  // Four sentences written, tested, and never once rendered: every
  // reminder in this clinic hung off the same consenting owner and the
  // same living animal, so the reasons a reminder will never be sent
  // existed only in the code that formats them.
  //
  // They share a due date on purpose. The list orders by it, so the
  // four land next to each other and next to the failures above --
  // which is the only way to ask whether four warnings in a column
  // read as information or as a wall. A state seen one at a time
  // cannot answer that.
  {
    id: "notification.reminder.blocked.optedOut",
    covers:
      "a reminder for an owner who refused: the row has to say nothing will go, and say it without implying anyone can fix it",
  },
  {
    id: "notification.reminder.blocked.neverAsked",
    covers:
      "one for an owner nobody has asked: the same silence with a different remedy, and the row's job is to send the vet to the phone rather than to the settings",
  },
  {
    id: "notification.reminder.blocked.noPhone",
    covers:
      "one for an owner who agreed but has no number on file: consent is not the obstacle here, and a row that blames consent sends the vet to the wrong field",
  },
  {
    id: "notification.reminder.blocked.petSilenced",
    covers:
      "one naming an animal that died: nothing will be sent and nothing was refused, which used to be no sentence at all",
  },

  {
    id: "notification.reminder.failedExhausted",
    covers:
      "three failures against one reminder: nothing automatic will try again, which is a different sentence from 'it will be retried' and the only state where the button is the whole answer",
  },

  // The loop's four resting places.
  { id: "reminder.pending", covers: "a reminder waiting to go" },
  {
    id: "reminder.sent",
    covers:
      "one sent, the animal not yet back: the work is still open after the message left, and the row's badge and its delivery sentence have to agree about that",
  },
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

  // The product's central promise is the vaccination loop, and the
  // table behind it was empty in every clinic -- so the dashboard card
  // read "no upcoming vaccinations" and nobody could tell that from a
  // card that does not work. Three records, because the field the whole
  // loop rests on has three states and the card treats them differently.
  {
    id: "vaccination.nextDue.future",
    covers: "a dose with its next date ahead: the only thing the upcoming card can show",
  },
  {
    id: "vaccination.nextDue.past",
    covers:
      "one whose next date has gone by: whether the 'upcoming' card silently drops the animals most overdue, which nothing today can confirm or refute",
  },
  {
    id: "vaccination.nextDue.none",
    covers:
      "a dose recorded with no next date at all: the fill rate's other half, and an animal the loop cannot bring back",
  },

  { id: "clinical.prescription", covers: "a prescription on an animal" },
  { id: "clinical.treatment", covers: "a treatment" },
  { id: "clinical.diagnostic", covers: "a diagnostic test" },
];

/**
 * A wall-clock time that says which clock it is on.
 *
 * `toISOString().slice(0, 16).replace("T", " ")` produced a UTC time
 * dressed as a local one: no `Z`, no offset, nothing to tell a reader
 * which zone it was. Beside `SERVED_COMMIT.txt`, which writes local
 * time, the two ground files sat three hours apart — so "the seed ran
 * before the build" could be read off two correct files and be false.
 * Exactly the failure a ground file exists to prevent.
 *
 * ux's repair, taken over mine: do not match the neighbour's zone,
 * carry the offset. Matching a zone sets the same trap on the next
 * machine; an offset misleads nobody. Local, because the reader's
 * clock and the file beside it are both local, and `+03:00` makes it
 * comparable rather than guessable.
 */
function localStamp(date) {
  // "sv-SE" is the shortest route to "YYYY-MM-DD HH:MM" in local time;
  // no locale-dependent word or order comes out of it.
  const local = date.toLocaleString("sv-SE").slice(0, 16);
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local}${sign}${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

/**
 * Which checkout the seed ran from, and whether it was clean.
 *
 * `SERVED_COMMIT.txt` says what code is being served and `SEEDED.txt`
 * says when the data last changed. Both were correct this afternoon
 * and together told a false story: a fixture was in the build and not
 * in the database, because the seed had run two minutes before the
 * commit that added it. Two grounds, each right, and nobody reading
 * the pair.
 *
 * A time cannot answer that -- "17:57" is only earlier than "17:59" if
 * you already know what landed at 17:59. A commit can: put it beside
 * the served one and the question becomes a string comparison.
 *
 * The dirty flag is the other half, and the more honest one here. A
 * bare hash claims more than it knows: seeding from a tree with
 * uncommitted changes produces data that matches no commit at all,
 * which is the state this repository is in most of the day.
 */
function seedingCheckout() {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  try {
    const commit = git("rev-parse", "--short", "HEAD");
    return git("status", "--porcelain") ? `${commit} (+ commit'lenmemiş değişiklik)` : commit;
  } catch {
    // Seeding does not depend on git, and not knowing is an answer --
    // a better one than a hash that might have come from anywhere.
    return "bilinmiyor";
  }
}

/**
 * A permanent address for a seeded record.
 *
 * The clinic is deleted and rebuilt on every run, so every row used to
 * get a fresh `cuid` — which meant every open page died mid-measurement
 * and every id quoted between people went stale. ux lost six rounds to
 * it. A stamp says the data moved; this says the address still works.
 *
 * Deterministic and readable, because the second is half the value:
 * "hal-pet-zeytin" can be pasted into a message and still mean
 * something tomorrow, where a cuid cannot. The prefix also makes it
 * obvious in any URL that this row is a fixture.
 *
 * Fixture-only. Records born from the product keep generating cuids —
 * a deterministic id is a property of this clinic, not of the schema,
 * and blurring that is how two real records would one day collide.
 * Nothing outside this file calls it.
 */
const halId = (...parts) => ["hal", ...parts].join("-");

/** A name as it can appear in a URL: folded, lower-case, dashed. */
const slug = (name) =>
  name
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DAY = 86_400_000;

/**
 * An instant as an ISO string, and the string is the point.
 *
 * Every timestamp column in this schema is `timestamp without time
 * zone` holding a UTC instant, because that is what Prisma writes.
 * Handed a JS `Date`, node-postgres serialises it in the machine's
 * LOCAL zone with an offset, and Postgres inserting into a naive
 * column keeps the wall clock and throws the offset away: seeding from
 * Europe/Istanbul stored 09:00 where Prisma stores 06:00. Three hours
 * of drift between the seeded rows and everything the application
 * writes, and no error anywhere.
 *
 * It surfaced the moment a row's clock time meant something — the busy
 * day's "the clinic opens at nine" arrived on screen as noon. Before
 * that it had been wrong all day in rows nobody read the hour of.
 *
 * `toISOString()` sends the instant in UTC, which the naive column
 * then stores as written. Pinning the session zone does NOT fix this:
 * the offset is decided by the client before Postgres sees it.
 */
const iso = (date) => date.toISOString();
const ago = (days) => iso(new Date(Date.now() - days * DAY));
/** Hours, for states the sweep's six-hour retry rule is measured in. */
const hoursAgo = (hours) => iso(new Date(Date.now() - hours * 3_600_000));
const ahead = (days) => iso(new Date(Date.now() + days * DAY));

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
  // Every timestamp column here is `timestamp without time zone`
  // holding a UTC instant, because that is what Prisma writes. A JS
  // Date handed to `pg` is converted to the SESSION's time zone first,
  // so seeding from a machine in Europe/Istanbul stored 09:00 where
  // Prisma would have stored 06:00 — three hours of drift between the
  // seeded rows and everything the application writes, invisible until
  // a row's clock time mattered.
  //
  // The write side is fixed by `iso()` above, which is where the drift
  // actually comes from. This pins the session as well, so that
  // anything computed by Postgres itself here — `now()` in an
  // `updatedAt`, a comparison in a later addition — agrees with it.
  // Same repair scripts/loop-metrics.mjs makes on the reading side.
  await db.query("SET TIME ZONE 'UTC'");

  const produced = [];
  const made = (id) => produced.push(id);
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];

  // Rebuilt, not added to; the cascade takes every record with it.
  await db.query(`DELETE FROM clinics WHERE name = $1`, [STATE_CLINIC_NAME]);

  const clinic = await one(
    `INSERT INTO clinics (id, name, currency, timezone, settings, "updatedAt")
     VALUES ($3, $1, 'TRY', 'Europe/Istanbul', $2::jsonb, now())
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
    //
    // Messaging is ON here, and this is the only clinic where it is on
    // on purpose (two pm test clinics have it on as well, from someone
    // switching it on by hand). The sweep skips a clinic whose
    // `whatsapp.enabled` is false before it looks at a single
    // appointment, so with this off the fixtures below would be rows
    // the sweep never reaches -- states that exist in the table and not
    // in the behaviour, which is the failure this clinic is here to
    // prevent.
    //
    // `hoursBefore: 48` rather than the default `morningOf`: the mode
    // decides at what hour of the clinic's day a reminder becomes due,
    // so `morningOf` makes whether a fixture is sendable depend on what
    // time the seed was run. Forty-eight hours is what lets the sendable
    // appointment below sit at a plausible hour of the working day and
    // still be inside the window whenever the seed is run.
    [
      STATE_CLINIC_NAME,
      JSON.stringify({
        notifications: {
          channel: "SMS",
          whatsapp: {
            enabled: true,
            confirmOnBooking: true,
            reminder: { mode: "hoursBefore", hoursBefore: 48, morningHour: 9 },
            reminders: { enabled: true, daysBefore: 3 },
          },
        },
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
      halId("clinic"),
    ],
  );
  made("species.builtIn.disabled");

  await db.query(
    `INSERT INTO users (id, "clinicId", name, email, "passwordHash", role, "updatedAt")
     VALUES ($4, $1, 'Hâl Yönetici', $2, $3, 'ADMIN', now())`,
    // Hashed here rather than pasted in as a literal: a hash copied into
    // a file is a derived artefact that nobody can check against the
    // password printed beside it, and the two would drift the first time
    // either changed. Same cost setting is used as the sign-up path.
    [
      clinic.id,
      STATE_CLINIC_LOGIN.email,
      await bcrypt.hash(STATE_CLINIC_LOGIN.password, 10),
      halId("user", "admin"),
    ],
  );

  const vet = await one(
    `INSERT INTO users (id, "clinicId", name, email, "passwordHash", role, "updatedAt")
     VALUES ($3, $1, 'Hâl Veteriner', $2, 'seed-only-never-a-login',
             'VETERINARIAN', now())
     RETURNING id`,
    // Deliberately long: the staff table and the appointment row both have
    // to survive an address that does not shorten.
    [
      clinic.id,
      "cok.uzun.bir.eposta.adresi.hal@ornek-veteriner-klinigi.example",
      halId("user", "vet"),
    ],
  );
  made("text.longEmail");

  // Three owners, because consent has three values and one row can only
  // hold one of them. Everything else in this clinic hangs off the first;
  // the other two exist to be looked at.
  const owner = async (key, firstName, lastName, phone, consent) =>
    one(
      `INSERT INTO clients (id, "clinicId", "firstName", "lastName", phone,
                            "notificationsOptIn", "updatedAt")
       VALUES ($6, $1, $2, $3, $4, $5, now())
       RETURNING id`,
      [clinic.id, firstName, lastName, phone, consent, halId("client", key)],
    );

  const client = await owner("consented", "Hâl", "Sahibi", "0532 000 00 00", true);
  made("client.consent.granted");
  const declined = await owner("declined", "Reddeden", "Sahip", "0532 000 00 01", false);
  made("client.consent.declined");
  // `null` and not "leave it out": the column has no default any more
  // (20260921180000), so an omitted value would also be null -- writing
  // it plainly is what says this row is the unasked state on purpose
  // rather than by inheritance.
  const unasked = await owner("unasked", "Sorulmamış", "Sahip", "0532 000 00 02", null);
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
     SELECT 'hal-client-yigin-' || to_char(n, 'FM00'), $1, 'Müşteri',
            'Yığın ' || to_char(n, 'FM00'),
            '0533 ' || to_char(n, 'FM000') || ' 00 00',
            NULL, now()
       FROM generate_series(1, 60) AS n`,
    [clinic.id],
  );
  made("client.list.capped");

  // The id comes from the animal's own name, lower-cased and stripped
  // of Turkish letters by the same fold the search uses -- so
  // "Zeytin" is always `hal-pet-zeytin`, and the address survives a
  // rebuild. Two animals with one name would collide, which is why the
  // busy day's eighteen are all named differently on purpose.
  const pet = async (name, species, extra = "", params = []) =>
    one(
      `INSERT INTO pets (id, "clinicId", "ownerId", name, species, "updatedAt"${extra ? `, ${extra.split("=")[0]}` : ""})
       VALUES (${extra ? "$6" : "$5"}, $1, $2, $3, $4::"Species", now()${extra ? `, $5` : ""})
       RETURNING id`,
      extra
        ? [clinic.id, client.id, name, species, ...params, halId("pet", slug(name))]
        : [clinic.id, client.id, name, species, halId("pet", slug(name))],
    );

  // Ordinary names, on purpose. They used to be "Etkin", "Arşivli" and
  // "Vefat" -- the state written on the animal -- which reads as a
  // convenience until you see what it costs: ux could tell a dead
  // animal apart in a picker because its NAME said so, and that makes
  // it impossible to test whether the SCREEN says so. A fixture whose
  // labels leak the state cannot measure whether the product shows it.
  // The state belongs in `covers`, above, and nowhere else.
  const active = await pet("Zeytin", "DOG");
  made("pet.active");
  const archived = await pet("Pamuk", "CAT", '"archivedAt"=', [ago(30)]);
  made("pet.archived");
  const dead = await one(
    `INSERT INTO pets (id, "clinicId", "ownerId", name, species, deceased, "deceasedAt", "updatedAt")
     VALUES ($4, $1, $2, 'Fındık', 'RABBIT', true, $3, now())
     RETURNING id`,
    [clinic.id, client.id, ago(60), halId("pet", "findik")],
  );
  made("pet.deceased");

  await db.query(
    `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "vetId", "startsAt",
                               type, status, reason, "updatedAt")
     VALUES ($6, $1, $2, $3, $4, $5, 'WELLNESS_CHECK', 'SCHEDULED',
             'Yıllık kontrol', now())`,
    [clinic.id, active.id, client.id, vet.id, ahead(2), halId("appt", "vet")],
  );
  made("appointment.vet.named");

  await db.query(
    `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "startsAt",
                               type, status, "updatedAt")
     VALUES ($5, $1, $2, $3, $4, 'VACCINATION', 'CONFIRMED', now())`,
    [clinic.id, active.id, client.id, ahead(3), halId("appt", "novet")],
  );
  made("appointment.vet.none");

  // Two appointments whose time has gone by, still open, and open in two
  // different ways. `/appointments` filters by one status at a time, so
  // "nobody came" and "they came and nothing was written down" are
  // walked separately -- and a suggestion that means to mark both has to
  // be able to produce both.
  //
  // Relative to the moment of seeding, never a fixed date. A fixed one
  // is in the past today and in the past in a year, but it reads
  // stranger every month until somebody asks why the data is from 2026.
  // `ago()` carries the definition of the state; a date carries one
  // example of it.
  //
  // The ordinary animal for both, not the archived or the deceased one:
  // the list hides those, so an appointment hung on one would be a
  // state that exists in the table and not on the screen -- the exact
  // failure this clinic is here to prevent. Two instants keep them
  // apart, which is all the per-animal-per-instant index asks
  // (20260921140000).
  for (const [key, status, when, reason] of [
    ["past-scheduled", "SCHEDULED", ago(1), "Gelmedi"],
    ["past-arrived", "ARRIVED", ago(2), "Geldi, sonuç yazılmadı"],
  ]) {
    await db.query(
      `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "vetId", "startsAt",
                                 type, status, reason, "updatedAt")
       VALUES ($8, $1, $2, $3, $4, $5, 'WELLNESS_CHECK',
               $6::"AppointmentStatus", $7, now())`,
      [clinic.id, active.id, client.id, vet.id, when, status, reason, halId("appt", key)],
    );
  }
  made("appointment.past.scheduled");
  made("appointment.past.arrived");

  // A day with a day's worth of work on it.
  //
  // Eighteen appointments on one past day, and the MIX is the state:
  // seven finished, three nobody came to, one called off, and seven
  // still open. A list where every row is marked answers nothing --
  // the question is whether a vet scanning this day can pick the
  // unfinished ones out of the finished ones, and five rows cannot ask
  // it either.
  //
  // Ordinary names, and here it matters most. In a crowd, a name that
  // says the state turns the measurement into "can you read the names"
  // -- the same trap that let a dead animal be spotted in a picker by
  // being called "Vefat".
  //
  // Each appointment gets its own animal, because a busy day is busy
  // with different animals, and because that is what the list actually
  // shows: a column of names a person scans down. Times run from 09:00
  // to 14:40 in the clinic's own zone, twenty minutes apart, which also
  // keeps every row distinct for the per-animal-per-instant index.
  const BUSY_DAY = [
    ["Duman", "DOG", "COMPLETED"],
    ["Mırnav", "CAT", "COMPLETED"],
    ["Karamel", "DOG", "NO_SHOW"],
    ["Şeker", "CAT", "COMPLETED"],
    ["Bulut", "RABBIT", "SCHEDULED"],
    ["Zümrüt", "BIRD", "COMPLETED"],
    ["Paşa", "DOG", "ARRIVED"],
    ["Minnoş", "CAT", "COMPLETED"],
    ["Kestane", "DOG", "NO_SHOW"],
    ["Limon", "BIRD", "SCHEDULED"],
    ["Badem", "CAT", "COMPLETED"],
    ["Çakıl", "DOG", "ARRIVED"],
    ["Yumak", "CAT", "CANCELLED"],
    ["Toprak", "DOG", "COMPLETED"],
    ["Kiraz", "RABBIT", "SCHEDULED"],
    ["Alev", "DOG", "NO_SHOW"],
    ["Gece", "CAT", "ARRIVED"],
    ["Tarçın", "DOG", "SCHEDULED"],
  ];
  const busyDay = new Date(ago(3));
  for (const [i, [name, species, status]] of BUSY_DAY.entries()) {
    const at = new Date(busyDay);
    // 06:00 UTC is 09:00 in Europe/Istanbul, which is when a clinic
    // opens. The column is naive UTC (the session is pinned above), so
    // the hour is set in UTC and read back as the clinic's morning.
    at.setUTCHours(6, i * 20, 0, 0);
    const animal = await pet(name, species);
    await db.query(
      `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "vetId", "startsAt",
                                 type, status, "updatedAt")
       VALUES ($7, $1, $2, $3, $4, $5, 'WELLNESS_CHECK',
               $6::"AppointmentStatus", now())`,
      [clinic.id, animal.id, client.id, vet.id, iso(at), status, halId("appt", slug(name))],
    );
  }
  made("appointment.day.busy");

  const visit = await one(
    `INSERT INTO visits (id, "clinicId", "petId", "clientId", "vetId", "visitedAt", type,
                         "chiefComplaint", "totalCents", currency, "updatedAt")
     VALUES ($7, $1, $2, $3, $4, $5, 'SICK_VISIT', $6, 45000, 'TRY', now())
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
      halId("visit", "sick"),
    ],
  );
  made("text.longTurkishLabel");

  await db.query(
    `INSERT INTO prescriptions (id, "clinicId", "petId", "visitId", "medicationName",
                                dosage, frequency, "startedAt", status, "updatedAt")
     VALUES ($5, $1, $2, $3, 'Amoksisilin', '250 mg',
             'Günde iki kez', $4, 'ACTIVE', now())`,
    [clinic.id, active.id, visit.id, ago(7), halId("prescription")],
  );
  made("clinical.prescription");

  await db.query(
    `INSERT INTO treatments (id, "clinicId", "petId", "visitId", name, "performedAt", "updatedAt")
     VALUES ($5, $1, $2, $3, 'Yara temizliği ve pansuman', $4, now())`,
    [clinic.id, active.id, visit.id, ago(7), halId("treatment")],
  );
  made("clinical.treatment");

  await db.query(
    `INSERT INTO diagnostics (id, "clinicId", "petId", "visitId", type, name,
                              "performedAt", "updatedAt")
     VALUES ($5, $1, $2, $3, 'XRAY', 'Sağ arka bacak röntgeni', $4, now())`,
    [clinic.id, active.id, visit.id, ago(7), halId("diagnostic")],
  );
  made("clinical.diagnostic");

  // The three states of the one field the return loop rests on.
  //
  // `upcomingVaccinations` filters `nextDueAt >= now`, so the overdue
  // row below is the case that decides whether the dashboard card
  // quietly hides the animals furthest past their date -- the claim
  // has been made twice and could be neither confirmed nor refuted,
  // because the table was empty in every clinic.
  //
  // Three vaccines rather than three doses of one: the suggestion
  // logic needs several records of the same vaccine on the same
  // species before it offers an interval, and three identical ones
  // here would put a suggestion on the form as a side effect of a
  // fixture built for the card.
  for (const [key, name, nextDueAt, stateId] of [
    ["kuduz", "Kuduz aşısı", ahead(21), "vaccination.nextDue.future"],
    ["karma", "Karma aşı", ago(45), "vaccination.nextDue.past"],
    ["bronsin", "Bronşin aşısı", null, "vaccination.nextDue.none"],
  ]) {
    await db.query(
      `INSERT INTO vaccinations (id, "clinicId", "petId", "administeredById", name,
                                 "administeredAt", "nextDueAt", "updatedAt")
       VALUES ($6, $1, $2, $3, $4, $5, $7, now())`,
      [clinic.id, active.id, vet.id, name, ago(365), halId("vaccination", key), nextDueAt],
    );
    made(stateId);
  }

  // The invoice number already names the state ("HAL-PAID-USD"), so the
  // address comes from it rather than from a second list that could
  // disagree with it.
  const invoice = async (number, status, currency, cents, paidAt) => {
    const key = slug(number.replace(/^HAL-/, ""));
    const row = await one(
      `INSERT INTO invoices (id, "clinicId", "clientId", number, currency, status,
                             "issuedAt", "paidAt", "subtotalCents", "totalCents", "updatedAt")
       VALUES ($9, $1, $2, $3, $4, $5::"InvoiceStatus", $6, $7, $8, $8, now())
       RETURNING id`,
      [clinic.id, client.id, number, currency, status, ago(20), paidAt, cents,
       halId("invoice", key)],
    );
    await db.query(
      `INSERT INTO invoice_lines (id, "invoiceId", description, quantity,
                                  "unitPriceCents", "totalCents")
       VALUES ($3, $1, 'Muayene', 1, $2, $2)`,
      [row.id, cents, halId("invoice-line", key)],
    );
    return row;
  };

  await invoice("HAL-DRAFT", "DRAFT", "TRY", 20_000, null);
  made("invoice.draft");
  await invoice("HAL-SENT", "SENT", "TRY", 30_000, null);
  made("invoice.sent");
  await invoice("HAL-VOID", "VOID", "TRY", 40_000, null);
  made("invoice.void");

  const pay = async (key, invoiceId, cents, method, at) =>
    db.query(
      `INSERT INTO payments (id, "invoiceId", "amountCents", method, "paidAt")
       VALUES ($5, $1, $2, $3::"PaymentMethod", $4)`,
      [invoiceId, cents, method, at, halId("payment", key)],
    );

  const partial = await invoice("HAL-PARTIAL", "PARTIAL", "TRY", 50_000, null);
  await pay("partial", partial.id, 20_000, "CASH", ago(10));
  made("invoice.partial");

  const paid = await invoice("HAL-PAID", "PAID", "TRY", 60_000, ago(5));
  await pay("paid", paid.id, 60_000, "CARD", ago(5));
  made("invoice.paid");
  made("invoice.paid.ownCurrency");

  // The clinic bills in lira; this one was issued in dollars and cannot be
  // added to the rest. It is the state that makes the line under the
  // revenue chart appear at all.
  const foreign = await invoice("HAL-PAID-USD", "PAID", "USD", 11_111, ago(5));
  await pay("paid-usd", foreign.id, 11_111, "TRANSFER", ago(5));
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
       VALUES ($6, $1, $2, $3, $4::"NoteKind", $5, now())`,
      [clinic.id, active.id, vet.id, kind, body, halId("note", slug(kind))],
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
       VALUES ($7, $1, $2, $3, 'CHECKUP', 'Kontrol hatırlatması',
               $4, $5::"ReminderStatus", $6, now())`,
      [clinic.id, client.id, active.id, dueAt, status, sentAt,
       halId("reminder", slug(status))],
    );
    made(id);
  }

  // The message behind the SENT one, and the reason it has to exist.
  //
  // This row carried `status = SENT` and no `MessageLog`, so its badge
  // said "Gönderildi" while the delivery line, which reads the log and
  // not the status, had nothing to say -- a row making a claim the row
  // below it could not corroborate. Measured before fixing it: one such
  // reminder in the whole database, this fixture, and no path in the
  // product that could make another. The screen offers ACKNOWLEDGED,
  // DISMISSED and PENDING; the only two writers of SENT are the sweep
  // and the manual send, and both write the log first.
  //
  // So the fixture was asserting a state the product cannot reach,
  // which is worse than a missing state: it invites a sentence for a
  // case that will never arrive. The data is what was wrong.
  await db.query(
    `INSERT INTO message_logs (id, "clinicId", "clientId", "reminderId", channel, kind,
                               recipient, language, body, status, "providerId", "createdAt")
     VALUES ($5, $1, $2, $3, 'SMS', 'REMINDER_DUE', '905320000000', 'tr',
             'Sayın Hâl Sahibi, Zeytin için kontrol zamanı yaklaşıyor. HÂL KLİNİĞİ',
             'SENT', 'log-seed', $4)`,
    [clinic.id, client.id, halId("reminder", "sent"), ago(3), halId("messagelog", "sent")],
  );

  // What the sweep can actually pick up, and the row beside it that it
  // must not. Before these, messaging was off for this clinic and the
  // sweep skipped it before looking at a single appointment, so "0 sent"
  // was the only answer it was capable of giving anywhere in the
  // database.
  //
  // Tomorrow at ten in the morning, clinic time, against the clinic's
  // `hoursBefore: 48`.
  //
  // Both halves of that matter. "Now plus twelve hours" was sendable on
  // any clock too, but it put the appointment at 05:47 when the seed
  // happened to run at 17:47 -- and a fixture at an hour no clinic works
  // is one a reader has to look past to believe the rest. A wall-clock
  // hour on the next day is between ten and thirty-four hours away
  // whenever the seed is run, so it is always ahead and always inside
  // the window, without the window ever deciding the hour.
  const sendableStart = new Date(Date.now() + DAY);
  // 07:00 UTC is 10:00 in Europe/Istanbul; the column is naive UTC and
  // the session is pinned to it above, same as the busy day.
  sendableStart.setUTCHours(7, 0, 0, 0);
  const sendableAt = iso(sendableStart);

  // The refusing owner needs an animal of their own. Everything else in
  // this clinic hangs off the consenting owner, and hanging the
  // counter-example off the same animal would make the pair differ in
  // two things instead of one -- and a pair that differs in two things
  // cannot measure either.
  const refused = await one(
    `INSERT INTO pets (id, "clinicId", "ownerId", name, species, "updatedAt")
     VALUES ($3, $1, $2, 'Kömür', 'CAT', now())
     RETURNING id`,
    [clinic.id, declined.id, halId("pet", "komur")],
  );

  for (const [key, petId, clientId, stateId] of [
    ["due", active.id, client.id, "notification.appointment.sendable"],
    ["refused", refused.id, declined.id, "notification.appointment.optedOut"],
  ]) {
    await db.query(
      `INSERT INTO appointments (id, "clinicId", "petId", "clientId", "vetId", "startsAt",
                                 type, status, reason, "updatedAt")
       VALUES ($6, $1, $2, $3, $4, $5, 'VACCINATION', 'SCHEDULED', 'Aşı tekrarı', now())`,
      [clinic.id, petId, clientId, vet.id, sendableAt, halId("appt", key)],
    );
    made(stateId);
  }

  // The other half of the loop, and the half the complaint was about:
  // the reminder a vet writes down. Due in two days against the
  // clinic's `daysBefore: 3`, so its notice is due from three days
  // before until the end of the due day -- inside that span now, and
  // still inside it tomorrow. The PENDING reminder above is seven days
  // out and stays not-yet-due, which is the pair: one goes, one waits.
  await db.query(
    `INSERT INTO reminders (id, "clinicId", "clientId", "petId", type, title,
                            "dueAt", status, "updatedAt")
     VALUES ($5, $1, $2, $3, 'VACCINATION_DUE', 'Karma aşı zamanı', $4, 'PENDING', now())`,
    [clinic.id, client.id, active.id, ahead(2), halId("reminder", "due")],
  );
  made("notification.reminder.sendable");

  // Three reminders that could not be sent, and the differences
  // between them are the whole point.
  //
  // `MessageLog.error` holds the transport's stable code, never the
  // provider's sentence, so the scope can be read back from it
  // (`lib/messaging/failures.ts`). `40` is the clinic's problem: an
  // unapproved sender title fails every message the clinic sends, so
  // repeating it on each row would send a vet to forty owners over one
  // setting. `85` really is about the one message.
  //
  // The dueAt puts all three inside the sweep's notice window on
  // purpose: they are candidates, and the sweep leaves them alone for
  // three different named reasons. Before this, `coolingOff` and
  // `attemptsExhausted` were counters that could never be anything but
  // zero, which is a summary line nobody can check.
  const failedReminder = async (key, title, failures) => {
    const row = await one(
      `INSERT INTO reminders (id, "clinicId", "clientId", "petId", type, title,
                              "dueAt", status, "updatedAt")
       VALUES ($5, $1, $2, $3, 'VACCINATION_DUE', $6, $4, 'PENDING', now())
       RETURNING id`,
      [clinic.id, client.id, active.id, ahead(2), halId("reminder", key), title],
    );
    for (const [i, [code, at]] of failures.entries()) {
      await db.query(
        `INSERT INTO message_logs (id, "clinicId", "clientId", "reminderId", channel, kind,
                                   recipient, language, body, status, error, "createdAt")
         VALUES ($7, $1, $2, $3, 'SMS', 'REMINDER_DUE', '905320000000', 'tr', $4,
                 'FAILED', $5, $6)`,
        [
          clinic.id,
          client.id,
          row.id,
          `Sayın Hâl Sahibi, Zeytin için ${title.toLocaleLowerCase("tr")} yaklaşıyor. HÂL KLİNİĞİ`,
          code,
          at,
          halId("messagelog", key, String(i + 1)),
        ],
      );
    }
    return row;
  };

  // One attempt, an hour ago: still waiting for the next sweep, and
  // the cause is one a vet fixes in settings rather than on this row.
  await failedReminder("failed-clinic", "Kuduz aşısı zamanı", [
    ["sender_title_not_registered", hoursAgo(1)],
  ]);
  made("notification.reminder.failedClinic");

  await failedReminder("failed-message", "Karma aşı zamanı", [
    ["duplicate_send_blocked", hoursAgo(1)],
  ]);
  made("notification.reminder.failedMessage");

  // Three failures, days apart: the sweep has given up, and the only
  // thing that can move this row now is a person pressing send.
  await failedReminder("failed-exhausted", "Bronşin aşısı zamanı", [
    ["duplicate_send_blocked", hoursAgo(2)],
    ["duplicate_send_blocked", ago(1)],
    ["duplicate_send_blocked", ago(2)],
  ]);
  made("notification.reminder.failedExhausted");

  // The four reasons a reminder will never go out, one row each.
  //
  // Each needs an owner or an animal of its own, because the obstacle
  // IS the fixture: hung on the ordinary owner they would all read as
  // "will be sent". The no-phone owner has agreed to messages on
  // purpose -- consent must not be the obstacle, or the row would be
  // measuring the sentence above it rather than its own.
  //
  // They are also the four the sweep's own query drops, so each one
  // lights a census counter that no data in this database could make
  // non-zero before: the reminder half reported optedOut, noPhone and
  // petSilenced as zeros nobody could check.
  const noPhone = await owner("nophone", "Numarasız", "Sahip", null, true);

  const blocked = async (key, clientId, petId, title, stateId) => {
    await db.query(
      `INSERT INTO reminders (id, "clinicId", "clientId", "petId", type, title,
                              "dueAt", status, "updatedAt")
       VALUES ($6, $1, $2, $3, 'CHECKUP', $5, $4, 'PENDING', now())`,
      [clinic.id, clientId, petId, ahead(2), title, halId("reminder", key)],
    );
    made(stateId);
  };

  await blocked(
    "blocked-optedout",
    declined.id,
    refused.id,
    "Kontrol hatırlatması",
    "notification.reminder.blocked.optedOut",
  );
  await blocked(
    "blocked-neverasked",
    unasked.id,
    null,
    "Kontrol hatırlatması",
    "notification.reminder.blocked.neverAsked",
  );
  await blocked(
    "blocked-nophone",
    noPhone.id,
    null,
    "Kontrol hatırlatması",
    "notification.reminder.blocked.noPhone",
  );
  // On the deceased animal, and its owner is the ordinary consenting
  // one: the animal is the whole obstacle, and nothing else about the
  // row may be able to explain the silence.
  await blocked(
    "blocked-petsilenced",
    client.id,
    dead.id,
    "Kontrol hatırlatması",
    "notification.reminder.blocked.petSilenced",
  );

  // The archived and deceased animals get a history, so they are pages
  // with something on them rather than rows carrying a flag.
  for (const [key, petId, when, type] of [
    ["archived", archived.id, ago(120), "WELLNESS_CHECK"],
    ["deceased", dead.id, ago(200), "SICK_VISIT"],
  ]) {
    await db.query(
      `INSERT INTO visits (id, "clinicId", "petId", "clientId", "visitedAt", type, "updatedAt")
       VALUES ($6, $1, $2, $3, $4, $5::"VisitType", now())`,
      [clinic.id, petId, client.id, when, type, halId("visit", key)],
    );
  }

  // The data ground, stamped where the data is.
  //
  // There are three ways to check which CODE is being served
  // (SERVED_COMMIT.txt, a BUILD_ID match, the file's absence meaning a
  // build is running) and there was nothing at all for the data. A
  // reseed drops every session, changes every id, and says nothing: ux
  // lost a measurement to one mid-run and read "record not found" as a
  // product defect, because the commit had not moved.
  //
  // In the database, not in a file. A file describes the checkout of
  // whoever is looking, and here several people share one database --
  // the stamp has to belong to the thing that actually changed. It goes
  // in the state clinic's own settings, so the seed that writes it also
  // deletes it, and it cannot outlive the data it describes.
  const seededAt = new Date();
  await db.query(
    `UPDATE clinics SET settings = settings || $2::jsonb WHERE id = $1`,
    [
      clinic.id,
      JSON.stringify({
        // ISO-8601 with its `Z`, because this one is read by a
        // program (`scripts/loop-metrics.mjs`). The same instant goes
        // into SEEDED.txt as local time with an offset, because that
        // one is read by a person standing next to SERVED_COMMIT.txt.
        // Two notations, one instant, and both say which clock they
        // are on.
        seed: {
          at: seededAt.toISOString(),
          states: produced.length,
          // In the database for the same reason the time is: whoever
          // reads the data ground later is rarely whoever made it, and
          // this copy outlives any one checkout.
          commit: seedingCheckout(),
        },
      }),
    ],
  );

  return produced;
}

/**
 * TLS for a hosted database, none for a local one. The CI job and a
 * developer's Postgres speak plain TCP and refuse an SSL handshake, and
 * this script has to run there too, since the tap-target spec signs into
 * the clinic it builds.
 */
function sslFor(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
  } catch {
    // Not a URL: let pg decide.
  }
  return { rejectUnauthorized: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const connectionString =
    process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const db = new pg.Client({
    connectionString,
    ssl: sslFor(connectionString),
  });
  await db.connect();
  try {
    const produced = await buildStateClinic(db);
    const missing = STATES.filter((s) => !produced.includes(s.id));
    console.log(
      `${STATE_CLINIC_NAME}: ${produced.length}/${STATES.length} states`,
    );
    // Printed every run, beside the count. Whoever seeded it is rarely
    // whoever comes to measure it.
    console.log(
      `LOGIN [${STATE_CLINIC_LOGIN.email} / ${STATE_CLINIC_LOGIN.password}] — seed fixture, synthetic clinic only`,
    );

    // The data ground, written where the measurer is already looking.
    //
    // team-lead's protocol: beside SERVED_COMMIT.txt, in the served
    // checkout, so nobody has to learn a new habit — the person taking
    // a measurement opens that directory anyway. A reseed drops every
    // session and changes every id; ux lost a measurement to one
    // mid-run and read "record not found" as a product defect, because
    // the commit had not moved.
    //
    // Written after the build, and written even when states are
    // missing, with whatever count came out. A half-built clinic still
    // means new ids, which is the thing this file exists to announce.
    //
    // The database carries the same stamp (the clinic's own settings,
    // printed by loop-metrics as DATA_GROUND) and that one is
    // authoritative: this file describes the machine that ran the
    // seed, and the database describes the data everyone shares. They
    // disagree the moment somebody seeds from another checkout — in
    // which case believe the database.
    //
    // The served checkout is one machine's path. Anywhere else (CI, a
    // developer's clone) there is no such directory and no measurer
    // reading it, so the stamp is skipped and said to be skipped, rather
    // than a seed that built 35 states exiting 1 over a file nobody
    // there would open. SEED_STAMP_DIR points it elsewhere.
    const stampDir =
      process.env.SEED_STAMP_DIR ?? "/Users/yigitsonbahar/Manifest-prod";
    const stampPath = `${stampDir}/SEEDED.txt`;
    if (!existsSync(stampDir)) {
      console.log(`SEEDED (no stamp: ${stampDir} is not on this machine)`);
    } else await writeFile(
      stampPath,
      `# VERİNİN NE ZAMAN DEĞİŞTİĞİ. SERVED_COMMIT.txt'in veri tarafındaki eşi.\n` +
        `# Oku:  cat ${stampPath}\n` +
        `# Tur BAŞINDA ve SONUNDA oku. Değiştiyse ÖLÇÜM GEÇERSİZ —\n` +
        `# kodun değişmemiş olması yetmez.\n` +
        `#\n` +
        `seeded_at: ${localStamp(new Date())}\n` +
        `commit:    ${seedingCheckout()}\n` +
        `#          ^ SERVED_COMMIT.txt ile KARŞILAŞTIRIN. Tutmuyorsa derlemedeki\n` +
        `#            bir fikstür veritabanında olmayabilir: yeniden tohumlayın.\n` +
        `clinic:    ${STATE_CLINIC_NAME}  ${produced.length}/${STATES.length}\n` +
        `login:     ${STATE_CLINIC_LOGIN.email} / ${STATE_CLINIC_LOGIN.password}\n` +
        `note:      oturumlar düştü, kayıt kimlikleri YENİ\n`,
    );
    if (existsSync(stampDir)) console.log(`SEEDED [${stampPath}]`);
    if (missing.length > 0) {
      console.error("not produced:", missing.map((s) => s.id).join(", "));
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}
