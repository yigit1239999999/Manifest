// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * One save, one toast.
 *
 * A user reported the same confirmation arriving twice, and pm
 * reproduced it 3/3 with the mechanism proved by a control: two
 * settings cards listed the TRANSLATOR in the effect's dependencies
 * and doubled; the third listed the resolved STRING and did not.
 * `useTranslations` returns a new function identity on a re-render, so
 * a dependency on it re-runs the effect for a render that changed
 * nothing. A string is equal to itself.
 *
 * The gap between the two toasts ran from 160ms to four seconds, which
 * is the fingerprint: one event fired twice would space them evenly.
 * This is re-render driven, so it depends on when a re-render happens.
 *
 * Read from the source rather than rendered, deliberately. Rendering
 * proves one form at a time, and the defect is a HABIT -- the next
 * form is written by copying the last one. Nine files carried the
 * pattern when this was written; two had been seen misbehaving and
 * seven had not, which is exactly why a per-form test would have
 * missed them.
 *
 * WHAT IT DOES NOT CHECK: that a toast fires at all, or that its words
 * are right. It checks that the thing the effect watches cannot change
 * identity without its value changing.
 */
describe("a saved confirmation appears once", () => {
  it("never depends on a translator function to decide it has fired", async () => {
    const dir = resolve("components/forms");
    const files = (await readdir(dir)).filter(
      (f) => f.endsWith(".tsx") && !f.includes(".test."),
    );
    expect(files.length).toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(resolve(dir, file), "utf8");
      for (const deps of source.matchAll(/\}, \[([^\]]*state\.success[^\]]*)\]/g)) {
        // A translator is `t`, `tCommon`, `tPet` -- the convention in
        // this directory. A resolved message is a `…Message` string.
        const named = deps[1]
          .split(",")
          .map((d) => d.trim())
          .filter((d) => /^t[A-Z]?\w*$/.test(d));
        if (named.length > 0) offenders.push(`${file}: ${named.join(", ")}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
