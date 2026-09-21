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

/** The route, as a reader of a failure would name it: "pets/[id]/page.tsx". */
function routeOf(file: string): string {
  return file.slice(appDir.length + 1);
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

describe("actions that lead somewhere the role may not go", () => {
  // The third way a screen promises what it cannot deliver, after the two
  // above: a button that takes someone to a form the server will refuse.
  //
  // There is no security hole here and the comment has to say so, or the
  // next reader mistakes this for an access check and trusts it in the wrong
  // place. The services enforce the same permissions themselves
  // (`modules/appointments/service.ts:22`, `:58`, `:95`, and their
  // counterparts). What is protected is honesty: a vet tech was shown
  // "Edit", "Cancel the appointment" and "Record the outcome" on an
  // appointment they have no write permission for, and every one of those
  // clicks ended in a refusal — or worse, in a form that looked fillable.
  //
  // Ten pages were fixed by hand. Nothing told the person writing the
  // eleventh, which is exactly how the same class came back one screen over
  // after `/audit` was fixed (TEAM.md #4, #6).

  /** `href="/pets/new"` and `` href={`/pets/${id}/edit`} `` alike. */
  const HREF = /href=(\{`[^`]*`\}|"[^"]*")/g;
  const WRITE_ROUTE = /\/(edit|new)(\?[^"`]*)?("|`)/;

  const offersWriteRoute = (source: string) =>
    [...source.matchAll(HREF)].some((m) => WRITE_ROUTE.test(m[0]));

  const withWriteRoute = pages.filter((file) =>
    offersWriteRoute(readFileSync(file, "utf8")),
  );

  it("finds them at all, so a regex that stopped matching cannot pass", () => {
    expect(withWriteRoute.length).toBeGreaterThan(5);
  });

  it("every page offering one asks whether the role may", () => {
    const offenders = withWriteRoute.filter(
      (file) => !readFileSync(file, "utf8").includes("can("),
    );

    expect(offenders.map(routeOf)).toEqual([]);
  });

  // What this deliberately does NOT check, so that nobody reads more
  // assurance into a green run than it gives: that the page asks about *this*
  // link, or that it asks about the right permission. `/pets/new` passes on
  // the strength of a `can()` guarding something else entirely. Both would
  // need the call graph rather than the file, and the coarse version already
  // catches the failure that actually happened — a page that never asked at
  // all. The permission matching the service's is a review question, and the
  // reason it is written down is in the page: the screen has to ask the same
  // question the server answers, or the two drift into a hidden door that is
  // open, or a visible one that is shut.
});
