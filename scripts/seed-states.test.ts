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
    const { db, statements } = recorder();

    await buildStateClinic(db);

    expect(statements[0]).toContain("DELETE FROM clinics");
    expect(db.query.mock.calls[0][1]).toEqual([STATE_CLINIC_NAME]);
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
