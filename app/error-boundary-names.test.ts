import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOUNDARY_NAMES } from "@/e2e/helpers";

// The e2e gate that fails a test standing on a crashed page listens for
// `console.error(boundary, …)` and matches the name against its own list
// (`e2e/helpers.ts`). That list and the `boundary="…"` props are one list
// kept in two places: add a third boundary, forget the list, and the gate
// falls silent on that screen -- the exact defect the gate exists to
// catch, reproduced one level up. A comment cannot hold that; this can.
//
// Scanned rather than imported: the call sites are JSX props in route
// files that pull in React, next-intl and Sentry, so a test that loads
// them is testing the import graph rather than the rule.
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));

function* tsxFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* tsxFiles(path);
    else if (entry.endsWith(".tsx")) yield path;
  }
}

function boundaryNamesInSource(): string[] {
  const found = new Set<string>();
  for (const file of tsxFiles(APP_DIR)) {
    for (const m of readFileSync(file, "utf8").matchAll(/boundary="([^"]+)"/g)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
}

describe("the e2e error-boundary gate knows every boundary", () => {
  it("watches exactly the names the route files pass", () => {
    expect([...BOUNDARY_NAMES].sort()).toEqual(boundaryNamesInSource());
  });

  // The other half of the assertion: if the scan stops matching -- a
  // boundary named through a variable, a renamed prop, a moved file --
  // the test above would compare two empty lists and pass. This is what
  // makes the first one able to go red.
  it("finds the call sites it is scanning for", () => {
    expect(boundaryNamesInSource()).toEqual(["app.error", "app.section"]);
  });
});
