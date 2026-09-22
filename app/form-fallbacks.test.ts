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
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

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

// A fallback covers the route it describes, and nothing below it.
//
// `loading.tsx` wraps its own segment AND everything nested under it, so
// a skeleton drawn for a list is also the skeleton every route beneath
// that list waits under. On a hard navigation the reader sees it first
// and the route's own a moment later: pm measured `/visits/new` at
// 60kbps and found two, the list's 28 pulses at t=1599 and the form's
// own four SOAP boxes at t=1939. In-app navigation never shows the
// first, which is why this survived a whole afternoon of measuring.
//
// The fix is a route group -- `visits/(list)/page.tsx` -- which keeps
// the URL and puts the fallback beside the one page it is about. This
// check is the rule rather than the fix: a `loading.tsx` may not sit in
// a segment that has routes underneath it.
//
// NOT CHECKED: whether the fallback matches its page's shape. That is
// what the rest of this file and pm's tape are for.
describe("a fallback covers only its own route", () => {
  const fallbacks = filesUnder(appDir).filter((file) =>
    file.endsWith("loading.tsx"),
  );

  it("finds the fallbacks, so an empty scan cannot pass", () => {
    expect(fallbacks.length).toBeGreaterThanOrEqual(20);
  });

  it("never sits above another route", () => {
    const covering: string[] = [];

    for (const file of fallbacks) {
      const dir = file.slice(0, file.lastIndexOf("/"));
      // A page one level down or further is a route this fallback would
      // be drawn for. Its own page sits beside it, so it does not count.
      const below = filesUnder(dir).filter(
        (f) =>
          f.endsWith("page.tsx") && f.slice(dir.length + 1).includes("/"),
      );
      if (below.length > 0) {
        covering.push(
          `${routeOf(file)} is drawn for ${below.length} route(s) below it, ` +
            `e.g. ${routeOf(below[0])}`,
        );
      }
    }

    expect(covering).toEqual([]);
  });
});

// What the fallback reserves, against what the form actually renders.
//
// The rest of this file is about SHAPE -- that a form route waits under a
// form and not under a list. This is the other half, and it is the half
// that rots: `dev` put a "there is no number" tick into the telephone
// field (`PhoneOrNone`), the skeleton went on drawing a plain field, and
// nothing anywhere went red. pm found it with a tape measure, 36px on
// `/clients/new`, an afternoon later.
//
// Counting controls would not have caught it. The form had four things
// above its fold and the skeleton drew four boxes; what changed was
// WHICH four. So the comparison is by kind: a telephone is not a field,
// a consent question is not a field, and a skeleton that swaps one for
// another is reserving the wrong height while agreeing on the count.
//
// Read from source rather than rendered, deliberately. Rendering the
// real forms needs a page's worth of fixtures each -- species lists,
// capped client lists, a locale -- and a test that heavy gets skipped
// the first time it is inconvenient. This one reads two files.
//
// NOT CHECKED, and the line is worth knowing:
//   - heights. Kinds line up here; whether a `rows={4}` textarea box is
//     the same 98px in both is pm's tape, not this.
//   - controls behind the fold, which the skeleton is right not to draw.
//   - anything a form renders conditionally (the new-animal block on
//     `/visits/new` opens for a returning draft and is not reserved).

/**
 * Every form route, the component it settles into, and -- where the
 * fallback deliberately stops early -- why.
 *
 * The ledger is checked against the routes found on disk below, so a new
 * form route cannot be added without landing here.
 */
const FORM_ROUTES: readonly {
  route: string;
  form: string;
  partial?: string;
}[] = [
  { route: "appointments/new", form: "appointment-form" },
  { route: "appointments/[id]/edit", form: "appointment-form" },
  { route: "invoices/new", form: "invoice-form" },
  { route: "visits/new", form: "visit-form" },
  { route: "visits/[id]/edit", form: "visit-form" },
  { route: "clients/new", form: "client-form" },
  { route: "staff/new", form: "staff-form" },
  {
    route: "clients/[id]/edit",
    form: "client-form",
    partial: "the fold opens on data this page has not loaded yet",
  },
  {
    route: "pets/new",
    form: "pet-form",
    partial: "the species chips are one per species the clinic enabled",
  },
  {
    route: "pets/[id]/edit",
    form: "pet-form",
    partial: "the species chips, and the fold on top of them",
  },
];

type Kinds = Record<string, number>;

const countOf = (source: string, patterns: Record<string, RegExp>): Kinds => {
  const out: Kinds = {};
  for (const [kind, pattern] of Object.entries(patterns)) {
    const n = source.match(pattern)?.length ?? 0;
    if (n > 0) out[kind] = n;
  }
  return out;
};

// Everything above the fold, which is everything the skeleton is ever on
// screen for. `OptionalDetails` closes over the rest.
const aboveTheFold = (source: string) => {
  const fold = source.indexOf("<OptionalDetails");
  return fold === -1 ? source : source.slice(0, fold);
};

const formKinds = (form: string): Kinds =>
  countOf(aboveTheFold(readFileSync(`${projectRoot}components/forms/${form}.tsx`, "utf8")), {
    field: /<Field[\s>]/g,
    phone: /<PhoneOrNone[\s>]/g,
    consent: /<ConsentChoice[\s>]/g,
  });

const skeletonKinds = (route: string): Kinds =>
  countOf(readFileSync(`${appDir}/${route}/loading.tsx`, "utf8"), {
    field: /<FieldSkeleton[\s/>]/g,
    phone: /<PhoneFieldSkeleton[\s/>]/g,
    consent: /<ConsentSkeleton[\s/>]/g,
  });

describe("a fallback reserves the controls the form renders", () => {
  it("has a ledger entry for every form route on disk", () => {
    // Discovered, not listed: a route added without an entry fails here
    // rather than being quietly left out of the checks below.
    expect(new Set(FORM_ROUTES.map((r) => r.route))).toEqual(
      new Set(formPages.map((f) => routeOf(f).replace("/page.tsx", ""))),
    );
  });

  it("reads real controls out of every form, so an empty scan cannot pass", () => {
    for (const { form } of FORM_ROUTES) {
      const total = Object.values(formKinds(form)).reduce((a, b) => a + b, 0);
      expect(total, `${form} above its fold`).toBeGreaterThanOrEqual(3);
    }
    for (const { route } of FORM_ROUTES) {
      const total = Object.values(skeletonKinds(route)).reduce((a, b) => a + b, 0);
      expect(total, `${route} fallback`).toBeGreaterThanOrEqual(2);
    }
  });

  it("draws the same kinds the form does, one for one", () => {
    const mismatched: string[] = [];

    for (const { route, form, partial } of FORM_ROUTES) {
      const wanted = formKinds(form);
      const drawn = skeletonKinds(route);

      if (partial) {
        // A route that stops early may draw FEWER of a kind, never a
        // kind the form does not have and never more of one.
        for (const [kind, n] of Object.entries(drawn)) {
          if (n > (wanted[kind] ?? 0)) {
            mismatched.push(
              `${route}: draws ${n} ${kind} box(es), form renders ${wanted[kind] ?? 0}`,
            );
          }
        }
        continue;
      }

      for (const kind of new Set([...Object.keys(wanted), ...Object.keys(drawn)])) {
        if ((wanted[kind] ?? 0) !== (drawn[kind] ?? 0)) {
          mismatched.push(
            `${route}: form renders ${wanted[kind] ?? 0} ${kind}, fallback draws ${drawn[kind] ?? 0}`,
          );
        }
      }
    }

    expect(mismatched).toEqual([]);
  });

  it("says why, wherever it stops early", () => {
    for (const entry of FORM_ROUTES.filter((r) => r.partial)) {
      expect(entry.partial!.length, entry.route).toBeGreaterThan(20);
    }
  });
});
