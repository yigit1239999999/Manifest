import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ownerLabel, ownerPhone } from "@/lib/pet-label";

/**
 * A name that is two columns and one fact.
 *
 * `Client.lastName` is nullable because the counter is not allowed to
 * ask the lady who brings the street cat for hers, and the product has
 * paid for that twice now. The first time was a trailing space --
 * "Limon · Ayşe " reading as a record with something missing off the
 * end -- and `ownerLabel` was written for it. The second was pm
 * finding "Ayşe null" in a picker, because a template literal renders
 * an absent surname as the word.
 *
 * So this is two tests and the second is the one that matters. The
 * first checks the helper, which was never wrong. The second checks
 * the HABIT: five call sites built this string by hand, two of them
 * written after the helper existed, and a per-screen test would have
 * caught whichever screen somebody happened to look at.
 *
 * WHAT IT DOES NOT CHECK: that a screen shows the owner at all, or
 * where. Only that nowhere joins the two columns itself.
 */
describe("the owner's name, wherever it is written down", () => {
  it("says what is known and nothing about what is not", () => {
    expect(ownerLabel({ firstName: "Ayşe", lastName: null })).toBe("Ayşe");
    expect(ownerLabel({ firstName: "Ayşe", lastName: "" })).toBe("Ayşe");
    expect(ownerLabel({ firstName: "Ayşe", lastName: "Çelik" })).toBe(
      "Ayşe Çelik",
    );
  });

  it("is never built by hand, in any file that ships", async () => {
    // A template literal (`${x.firstName} ${x.lastName}`) or the same
    // pair side by side in JSX ({x.firstName} {x.lastName}). Both
    // render the absence: one as "null", one as a trailing space.
    const byHand =
      /\$\{[\w.]*firstName\}\s+\$\{[\w.]*lastName\}|\{[\w.]*firstName\}\s+\{[\w.]*lastName\}/;

    const offenders: string[] = [];
    for (const dir of ["app", "components", "modules", "lib"]) {
      for await (const file of walk(resolve(dir))) {
        if (file.includes(".test.")) continue;
        const source = await readFile(file, "utf8");
        for (const [i, line] of source.split("\n").entries()) {
          if (byHand.test(line)) offenders.push(`${file}:${i + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(entry.name)) yield full;
  }
}

/**
 * The number the animal's page prints for an owner.
 *
 * This is here because the rule was agreed, reported as done, relayed
 * as verified -- and never landed. The row shipped reading only
 * `owner.phone`, so a client reachable on a second line was shown as
 * having none. Nobody saw it until somebody looked at the screen.
 *
 * So it is a test rather than a line: a rule that fell out silently
 * once will fall out again, and the first time it took a single
 * commit rather than six months.
 */
describe("which of an owner's numbers the animal's page shows", () => {
  it("prefers the first line", () => {
    expect(
      ownerPhone({ phone: "0532 111 22 33", secondaryPhone: "0555 999 88 77" }),
    ).toBe("0532 111 22 33");
  });

  it("falls back to the second, which is the case that was wrong", () => {
    // The defect: this printed nothing, and the page said "-" to a vet
    // standing in front of the animal.
    expect(ownerPhone({ phone: null, secondaryPhone: "0555 999 88 77" })).toBe(
      "0555 999 88 77",
    );
  });

  it("says nothing when there is no number", () => {
    expect(ownerPhone({ phone: null, secondaryPhone: null })).toBeNull();
  });

  it("does not widen to anything that is not a phone", () => {
    // The row answers "has this owner a PHONE", so an e-mail does not
    // make it answer yes. Written down because the fix for a row that
    // says too little is tempting to overshoot (value).
    expect(
      ownerPhone({ phone: null, secondaryPhone: null, email: "a@b.c" } as {
        phone: null;
        secondaryPhone: null;
      }),
    ).toBeNull();
  });

  it("treats a blank string as no number, not as an empty one", () => {
    // `??` would hand "" straight through and the page would print a
    // number with no digits in it.
    expect(ownerPhone({ phone: "   ", secondaryPhone: "0555 999 88 77" })).toBe(
      "0555 999 88 77",
    );
  });
});
