import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A form route that waits under a list is not waiting under a hint.
//
// `loading.tsx` covers the segment it sits in AND everything nested below
// it, so a form route without its own inherits whatever the section above
// has. Six of them did: `/clients/new` and `/staff/new` opened as a list
// of people with a search box, and the four `[id]/edit` routes opened as
// the two-column detail page of the very record the reader had just left.
// Nothing throws and nothing looks broken -- the screen simply settles
// into a different page a moment later, which is the failure this checks
// for, because review will not catch an absent file.
//
// NOT CHECKED, so nobody reads more into a green run than is here:
//   - that the skeleton is the same HEIGHT as the form. That is the
//     point of the exercise and it needs a browser; `pm` measures it.
//   - forms that live inside a page rather than on a route of their own
//     (the "new reminder" card, the vaccination and treatment forms).
//     Those wait under their page's own fallback, which is correct.
//   - routes that deliberately draw only part of a form (`/pets/new`,
//     `/pets/[id]/edit` and `/clients/[id]/edit` stop where the height
//     starts depending on data nobody has loaded yet). They still have
//     to use the form shell, and that is what is checked.

const appDir = fileURLToPath(new URL("./(app)", import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = `${dir}/${entry}`;
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

/** "clients/new/page.tsx", the way a reader of a failure would name it. */
function routeOf(file: string): string {
  return file.slice(appDir.length + 1);
}

// The routes that exist to be filled in. Named by their folder rather
// than by what the page imports: a page reaching a form through a
// wrapper would slip a scan of import lines, and `new`/`edit` is the
// convention this app actually follows.
const formPages = filesUnder(appDir).filter((file) => {
  const route = routeOf(file);
  return (
    file.endsWith("page.tsx") &&
    (route.endsWith("/new/page.tsx") || route.endsWith("/edit/page.tsx"))
  );
});

describe("a form route waits under a form", () => {
  it("finds the form routes, so an empty scan cannot pass", () => {
    expect(formPages.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every one of them its own fallback", () => {
    const missing = formPages
      .filter((file) => {
        const dir = file.slice(0, file.lastIndexOf("/"));
        return !readdirSync(dir).includes("loading.tsx");
      })
      .map(routeOf);

    expect(missing).toEqual([]);
  });

  it("draws a form in it, and never a list or a record", () => {
    const wrong: string[] = [];

    for (const file of formPages) {
      const dir = file.slice(0, file.lastIndexOf("/"));
      // A missing file is the test above's finding, and reading it here
      // would answer with a stack trace instead of the route's name.
      if (!readdirSync(dir).includes("loading.tsx")) continue;
      const source = readFileSync(`${dir}/loading.tsx`, "utf8");
      if (!source.includes("FormSkeleton")) {
        wrong.push(`${routeOf(file)}: fallback does not draw a form`);
      }
      for (const shape of ["ListSkeleton", "DetailSkeleton", "CardSkeleton"]) {
        if (source.includes(shape)) {
          wrong.push(`${routeOf(file)}: fallback draws a ${shape}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});
