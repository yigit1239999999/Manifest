import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A picker must not offer what the server will refuse.
//
// `createReminder` rejects an animal that has died. The reminder form's
// picker listed them anyway, so the vet chose one, typed the title and
// the date, submitted, and was answered on the animal field with
// nothing they could do about it. Not a data defect — the sweep filters
// dead animals too — a person walked into a dead end.
//
// The fix is one argument at one call site, which is exactly the kind
// of thing that comes off again: `excludeDeceased` is optional because
// most callers must NOT set it (a visit is routinely written up for an
// animal that died during it), so nothing about the type system or the
// tests around `listPets` requires the reminder page to pass it. This
// does.
//
// Written as a pairing rather than a path: any page rendering
// `ReminderForm` needs it, so a second one added tomorrow is covered
// without anybody remembering this file exists.

const APP = fileURLToPath(new URL("./(app)", import.meta.url));

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

describe("a form whose server refuses dead animals", () => {
  it("is never handed a list that contains them", () => {
    const offenders = pages(APP)
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) => source.includes("<ReminderForm"))
      // No `s` flag: this file compiles below es2018, and it is not
      // needed — `[^)]` crosses newlines on its own.
      .filter(
        ({ source }) => !/listPets\([^)]*excludeDeceased:\s*true/.test(source),
      )
      .map(({ path }) => path.slice(APP.length));

    expect(offenders).toEqual([]);
  });

  it("finds the page it is about, so an empty pass means something", () => {
    // Without this, renaming the form or moving the page turns the
    // assertion above into a test of nothing that passes forever — the
    // failure mode every source scan has, and the reason this one
    // counts what it looked at.
    const withForm = pages(APP).filter((path) =>
      readFileSync(path, "utf8").includes("<ReminderForm"),
    );

    expect(withForm.length).toBeGreaterThan(0);
  });
});
