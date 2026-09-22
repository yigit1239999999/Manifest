import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ownerLabel } from "@/lib/pet-label";

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
