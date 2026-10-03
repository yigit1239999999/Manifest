import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  STATES,
  STATE_CLINIC_LOGIN,
  STATE_CLINIC_NAME,
  buildStateClinic,
} from "./seed-states.mjs";

// The seed promises a list of states; this is what stops the promise and
// the work from drifting apart.
//
// Left as a comment, three states would quietly stop being produced inside
// six months and nobody would notice: the screens they exist for would go
// back to being unmeasurable, and a measurement would once again come back
// "clean" about a state the data cannot make. That is the failure this
// clinic was built to prevent, so it must not be the way the clinic itself
// fails.
//
// Run against a recorder rather than Postgres. What is being checked is
// the agreement between two lists, and a database would only make it
// slower and conditional on a connection.

function recorder() {
  const statements: string[] = [];
  const db = {
    // `params` is typed even though the recorder ignores it: one test
    // reads it back to prove the clinic is deleted by name.
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      void params;
      statements.push(sql);
      // Everything the seed reads back is an id it immediately passes to
      // the next insert; a stable fake is enough.
      return { rows: [{ id: `id-${statements.length}` }] };
    }),
  };
  return { db, statements };
}

describe("the state clinic produces what it promises", () => {
  it("builds every state on the list, and none that is not on it", async () => {
    const { db } = recorder();

    const produced = await buildStateClinic(db);

    expect([...produced].sort()).toEqual([...STATES.map((s) => s.id)].sort());
  });

  it("promises each state once", () => {
    // A duplicated id lets one state stand in for another and hides a gap
    // behind a count that still matches.
    const ids = STATES.map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says what each state is for", () => {
    // `covers` answers "why does this row exist", which is the question
    // someone deciding whether a screen can be checked is asking.
    //
    // Emptiness is all this checks, deliberately. The first version
    // demanded ten characters and failed on "an SMS" and "an event",
    // which are complete answers — a test satisfied by padding a sentence
    // is worse than no test. Whether a description says anything is a
    // review question; whether it exists is not.
    const silent = STATES.filter((s) => s.covers.trim() === "");

    expect(silent.map((s) => s.id)).toEqual([]);
  });

  it("clears the clinic before rebuilding it", async () => {
    // Run twice, the states are rebuilt and not doubled. Measurements are
    // taken against this database, and a seed that accumulates corrupts
    // the thing it exists to protect.
    //
    // The first statement that touches a table, not the first statement
    // outright: the seed pins the session's time zone before it does
    // anything, and that is not a write. What must hold is that nothing
    // is written before the delete — a row created first would be
    // deleted by it, or orphaned — and that the delete is scoped by the
    // clinic's name, which is the boundary of how much of this database
    // the seed is allowed to touch.
    const { db, statements } = recorder();

    await buildStateClinic(db);

    const writes = statements
      .map((sql, i) => ({ sql, i }))
      .filter(({ sql }) => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql));

    expect(writes[0].sql).toContain("DELETE FROM clinics");
    expect(db.query.mock.calls[writes[0].i][1]).toEqual([STATE_CLINIC_NAME]);
  });

  it("writes nothing outside its own clinic", async () => {
    // Everything here is synthetic. In the working clinic it would make
    // every agreed baseline incomparable: the frozen fill rate, the
    // back-filled currencies, the appointment counts.
    const { db, statements } = recorder();

    await buildStateClinic(db);

    const clinicsTouched = statements.filter((sql) =>
      /INSERT INTO clinics/.test(sql),
    );
    expect(clinicsTouched).toHaveLength(1);
  });
});

// The addresses. A rebuild used to change every id in the clinic, so a
// page somebody had open died mid-measurement and an id quoted in a
// message meant nothing an hour later; ux lost six rounds to it.
describe("addresses that survive a rebuild", () => {
  const seededIds = async () => {
    const { db } = recorder();
    await buildStateClinic(db);
    return db.query.mock.calls.flatMap(([, params]) =>
      (params ?? []).filter(
        (p): p is string => typeof p === "string" && p.startsWith("hal-"),
      ),
    );
  };

  it("gives every seeded row one", async () => {
    const { db } = recorder();

    await buildStateClinic(db);

    const inserts = db.query.mock.calls.filter(([sql]) => /INSERT INTO/i.test(sql));
    // The bulk of owners builds its ids in SQL ('hal-client-yigin-' || n)
    // rather than passing them as parameters, which is the same promise
    // made a different way.
    const addressless = inserts.filter(
      ([sql, params]) =>
        !/'hal-[a-z-]+' \|\|/.test(sql) &&
        !(params ?? []).some(
          (p) => typeof p === "string" && p.startsWith("hal-"),
        ),
    );

    expect(addressless.map(([sql]) => sql.trim().split("\n")[0])).toEqual([]);
    expect(inserts.filter(([sql]) => /gen_random_uuid/.test(sql))).toEqual([]);
  });

  it("gives the same one twice", async () => {
    // What "deterministic" has to mean in practice: the seed can be run
    // again and the links people are holding still open the same rows.
    expect(await seededIds()).toEqual(await seededIds());
  });
});

// The number lives in `.env` and never in this repository: committed
// once, it is in the history for good, and deleting it from a file
// does not delete it from git. Not a reversible mistake to make with
// somebody's phone number.
describe("a number that can actually ring", () => {
  it("points the reachable owner at it when the environment has one", async () => {
    vi.stubEnv("SEED_REAL_PHONE", "05559998877");
    const { db } = recorder();

    await buildStateClinic(db);

    const insert = db.query.mock.calls.find(
      ([sql, params]) =>
        /INSERT INTO clients/.test(sql) &&
        (params ?? []).includes("hal-client-consented"),
    );
    expect(insert?.[1]).toContain("05559998877");
    vi.unstubAllEnvs();
  });

  it("stays synthetic when it has none, rather than failing", async () => {
    // CI, a fresh clone, anyone's machine but the one: the seed must
    // build every state exactly as before. The variable is a switch,
    // not a requirement.
    vi.stubEnv("SEED_REAL_PHONE", "");
    const { db } = recorder();

    const produced = await buildStateClinic(db);

    expect([...produced].sort()).toEqual([...STATES.map((s) => s.id)].sort());
    const insert = db.query.mock.calls.find(
      ([sql, params]) =>
        /INSERT INTO clients/.test(sql) &&
        (params ?? []).includes("hal-client-consented"),
    );
    expect(insert?.[1]).toContain("0532 000 00 00");
    vi.unstubAllEnvs();
  });

  it("is never written into this file", async () => {
    // The guard for the rule itself: the seed reads the number at run
    // time and keeps no copy of it.
    const source = await readFile(new URL("./seed-states.mjs", import.meta.url), "utf8");
    expect(source).toContain("process.env.SEED_REAL_PHONE");

    // Every long digit run in the file has to be one of the invented
    // ones. A new number appearing here fails until somebody either
    // removes it or adds it to this list on purpose -- which is the
    // moment to notice it is real.
    // Migration stamps are 14 digits and are referenced by name in the
    // comments; a Turkish mobile is 10 to 12. Narrowing the match to
    // that range is what keeps this test about phone numbers.
    const SYNTHETIC = ["905320000000"];
    const runs = [...source.matchAll(/(?<!\d)\d{10,12}(?!\d)/g)].map((m) => m[0]);
    expect([...new Set(runs)].filter((d) => !SYNTHETIC.includes(d))).toEqual([]);

    // And on the one machine that has the real number, check that
    // exact string. Asserted as a boolean so a failure cannot print
    // the number into a terminal or a CI log.
    const real = process.env.SEED_REAL_PHONE?.trim();
    if (real) expect(source.includes(real)).toBe(false);
  });
});

describe("getting into the clinic to look at it", () => {
  it("creates an account that can actually sign in", async () => {
    // The vet row in this clinic has a sentence where its hash should
    // be, deliberately -- it exists to be displayed. If the admin ever
    // gets the same treatment, every state here becomes a claim nobody
    // can open, which is the one failure this clinic must not have.
    const { db } = recorder();

    await buildStateClinic(db);

    const insert = db.query.mock.calls.find(
      ([sql]) => /INSERT INTO users/.test(sql) && /ADMIN/.test(sql),
    );
    expect(insert).toBeDefined();
    const [, params] = insert!;
    expect(params).toContain(STATE_CLINIC_LOGIN.email);
    // A bcrypt hash, not the password and not a sentence.
    expect(params!.some((p) => typeof p === "string" && /^\$2[aby]\$/.test(p))).toBe(
      true,
    );
    expect(params).not.toContain(STATE_CLINIC_LOGIN.password);
  });
});
