import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A record page has to let go of the record.
 *
 * The vet who opens an appointment or a visit from the dashboard reads
 * the animal's name in the heading and then wants the one thing the
 * animal's own page holds: what happened last time. Four ways in, and
 * two of them -- the palette and `/pets` -- arrived at the history while
 * the other two dead-ended, because on those two screens the animal's
 * name is text. The way out was back into the list and a search for a
 * name already on screen.
 *
 * The rule this holds, in the form that can go red: on a record page
 * the paths to OTHER records live in the detail list, not the heading.
 * The heading names the record and carries what to do with it.
 *
 * Read from the source rather than rendered, and the trade is the one
 * `first-run-screen.test` states: rendering these two pages needs a
 * session, a clinic and a dozen queries stubbed, and would then assert
 * about the same JSX this reads. What this catches is membership -- a
 * page losing the exit, or a third record page arriving without one.
 *
 * What it does NOT catch, said out loud because the gap is the point:
 * whether the link WORKS. That is a journey, it has not been walked,
 * and `ux` found this by reading source too. A green run here is not a
 * vet getting to the history.
 */
const PAGES = [
  "./(app)/appointments/[id]/(record)/page.tsx",
  "./(app)/visits/[id]/(record)/page.tsx",
];

function sourceOf(page: string): string {
  return readFileSync(fileURLToPath(new URL(page, import.meta.url)), "utf8");
}

describe("a record page offers the way to the records it is about", () => {
  for (const page of PAGES) {
    const name = page.replace("./(app)/", "").replace("/(record)/page.tsx", "");

    it(`${name} links to the animal and its owner`, () => {
      const source = sourceOf(page);
      expect(source).toMatch(/href=\{`\/pets\/\$\{\w+\.pet\.id\}`\}/);
      expect(source).toMatch(/href=\{`\/clients\/\$\{\w+\.client\.id\}`\}/);
    });

    // The other half of the rule, and the half that decays quietly: the
    // exit is only an exit if it is where the reader looks for relations.
    // A link moved into the heading would keep the test above green and
    // lose the rule -- so the match has to be inside the items list.
    it(`${name} keeps those links in the detail list`, () => {
      const source = sourceOf(page);
      const items = source.slice(source.indexOf("items={["));
      expect(items).toMatch(/href=\{`\/pets\/\$\{\w+\.pet\.id\}`\}/);
      expect(items).toMatch(/href=\{`\/clients\/\$\{\w+\.client\.id\}`\}/);
    });
  }

  // The scan's own guard. Without it a renamed file, a moved route or a
  // changed template leaves the assertions above reading an empty string
  // and passing -- a test for a test, quietly green.
  it("is reading the pages it names", () => {
    for (const page of PAGES) {
      expect(sourceOf(page)).toContain("DescriptionList");
    }
  });
});
