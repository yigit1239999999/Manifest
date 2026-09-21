import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// v0.9.0 asks the consent question and records the answer. For one
// release it did not show it: the column was full, three-valued, and
// the only way to read it was to press Edit — opening a surface for
// changing a thing in order to look at it.
//
// A source scan rather than a render test, and the reason is the
// defect itself. What went wrong was an omission, and a render test
// only ever asserts what somebody remembered to render. This asserts
// that the detail page names the field at all.
const page = readFileSync(
  join(process.cwd(), "app/(app)/clients/[id]/page.tsx"),
  "utf8",
);

describe("a recorded consent answer is readable without editing", () => {
  it("names the field on the detail page", () => {
    expect(page).toContain("consent.label");
  });

  it("has a word for all three answers, including the third", () => {
    // The third is the one that took a release to get right. "Not
    // asked" is information, not a blank: it says there is work to
    // do, where "declined" says the question is closed.
    for (const key of [
      "consent.granted",
      "consent.declined",
      "consent.unanswered",
    ]) {
      expect(page, `${key} is missing from the detail page`).toContain(key);
    }
  });

  it("reads the value by identity, so null cannot collapse into no", () => {
    // `=== true` / `=== false`, not truthiness. A null folded into
    // "declined" writes a refusal nobody gave, which is the failure
    // the whole three-state change exists to prevent.
    expect(page).toMatch(/notificationsOptIn === true/);
    expect(page).toMatch(/notificationsOptIn === false/);
  });
});
