import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Two of the five states of a screen (TEAM.md #19) are decided by routing,
// not by a component: what a user sees when the record is gone, and what a
// user sees when their role does not reach the page. Both regress silently —
// nothing throws, no screen breaks, the user just lands somewhere unhelpful —
// so the rule lives here rather than in a task description.

const appDir = fileURLToPath(new URL("./(app)", import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = `${dir}/${entry}`;
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const pages = filesUnder(appDir).filter((f) => f.endsWith("page.tsx"));

/** The first path segment under `(app)`, e.g. "pets" for /pets/[id]/edit. */
function sectionOf(file: string): string {
  return file.slice(appDir.length + 1).split("/")[0];
}

describe("notFound() boundaries", () => {
  // Next resolves `notFound()` to the nearest `not-found.tsx` above the
  // throwing route. A section without one falls through to the shell-wide
  // boundary, whose only way out is the dashboard — so the user has to find
  // their way back to the list they were already in.
  it("every section that throws notFound() has its own boundary", () => {
    const sections = new Set(
      pages
        .filter((f) => readFileSync(f, "utf8").includes("notFound()"))
        .map(sectionOf),
    );

    const missing = [...sections].filter((section) => {
      const files = readdirSync(`${appDir}/${section}`);
      return !files.includes("not-found.tsx");
    });

    expect(missing).toEqual([]);
  });
});

describe("permission boundaries", () => {
  // A `redirect("/")` on a failed permission check reads, from the outside,
  // exactly like a bug: a bookmark or a shared link drops the user on the
  // dashboard with no explanation, so the natural next move is to click the
  // same link again. Being told no is a state; an unexplained relocation
  // is not one.
  //
  // Only the permission guard is in scope. A `redirect("/")` because the
  // data a page needs is missing is a different situation with a different
  // answer, so the match is anchored on the guard itself rather than on the
  // page merely containing both.
  it("no page redirects instead of showing the forbidden state", () => {
    const offenders = pages.filter((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/!can\(/g)].some((m) =>
        source.slice(m.index, m.index + 160).includes("redirect("),
      );
    });

    expect(offenders.map(sectionOf)).toEqual([]);
  });
});
