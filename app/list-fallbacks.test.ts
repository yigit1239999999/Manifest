import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A list that drops columns on a narrow screen puts what they held into
// the first cell instead. The stand-in and the columns it stands in for
// have to appear and disappear at the same moment, and there is exactly
// one way to get that right: the stand-in is hidden at the *last* of the
// breakpoints it covers.
//
// `/appointments` got it wrong in the direction nobody looks for. The
// block was hidden at `sm` and carried two things — the visit type, whose
// column arrives at `sm`, and the phone, whose column arrives at `md`.
// Between 640px and 767px, which is a tablet held upright, the phone was
// in neither place. Not duplicated: gone. Every gate passed, because the
// markup is well formed at every width; it is only wrong at some of them.
//
// The rule is a ceiling rather than an equality: hiding the stand-in
// later than its columns arrive shows the same thing twice, which is
// untidy. Hiding it earlier loses it, which is a defect. So a page may
// hide its stand-in at the widest `hideBelow` it uses, and no sooner.
//
// ux named the class "mismatched pair" and named the real reason it got
// through: the two numbers live in different halves of the file, one as a
// Tailwind class and one as a prop, and nothing says they have to agree.
// Review cannot catch that. This can, which is the only reason it exists.
//
// The proper fix is for a column to describe its own stand-in and the
// table to emit one breakpoint for both. ux weighed it and said not yet:
// two call sites do not justify the API (TEAM.md #30). Written down here
// rather than in a backlog line, because here is where the third list
// will be standing when it wants the same thing — and that is the day to
// build it.
//
// The rule has three forms and this checks one of them. Written out so
// that "there is a test for this" does not stop anyone looking:
//
//   1. no counterpart in the stand-in at all          -> gap   (NOT checked)
//   2. stand-in hidden before its column arrives      -> gap   (checked)
//   3. stand-in hidden after its column arrives       -> duplicate (allowed)
//
// Form 1 has a live candidate: `/appointments` gives the `vet` column
// `hideBelow: "md"` and puts nothing in the stand-in for it, so below
// 768px the vet's name is in neither place. It is not checked here and
// not fixed yet on purpose — every appointment in the database has an
// empty `vetId`, so nobody has yet seen a name disappear. value is
// having it confirmed on a real record first. Writing the check now
// would put a gate in front of a defect we have only reasoned our way
// to (TEAM.md #1).
//
// NOT CHECKED, so the next reader knows where this stops:
//   - form 1 above, for the reason given.
//   - whether the stand-in actually carries what the hidden columns held.
//     It checks the breakpoints line up, not the content.
//   - pages that drop columns without a stand-in at all.
//   - `hidden` applied by anything other than a Tailwind `*:hidden` class.

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const ORDER = ["sm", "md"] as const;
type Breakpoint = (typeof ORDER)[number];

function pages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) pages(path, out);
    else if (entry.name === "page.tsx") out.push(path);
  }
  return out;
}

describe("a stand-in outlives the columns it stands in for", () => {
  const files = pages(`${projectRoot}app`).filter((file) =>
    readFileSync(file, "utf8").includes("<DataTable"),
  );

  it("finds the lists, so an empty scan cannot pass", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it("is hidden no earlier than the last column it replaces", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      const dropped = [...source.matchAll(/hideBelow:\s*"(sm|md)"/g)].map(
        (m) => m[1] as Breakpoint,
      );
      if (dropped.length === 0) continue;

      // The stand-in: a block inside the table that disappears once the
      // columns are back. There is at most one per list today.
      const standIn = source.match(/className="[^"]*\b(sm|md):hidden\b[^"]*"/);
      if (!standIn) continue;

      const last = ORDER[Math.max(...dropped.map((b) => ORDER.indexOf(b)))];
      const hiddenAt = standIn[1] as Breakpoint;

      if (ORDER.indexOf(hiddenAt) < ORDER.indexOf(last)) {
        offenders.push(
          `${file.slice(projectRoot.length)}: stand-in hidden at ${hiddenAt}, ` +
            `but a column arrives at ${last}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("recognises the shapes it reads", () => {
    // Both halves are regexes over source, which is the kind of thing
    // that quietly stops matching.
    expect(/hideBelow:\s*"(sm|md)"/.exec('hideBelow: "md",')?.[1]).toBe("md");
    expect(
      /className="[^"]*\b(sm|md):hidden\b[^"]*"/.exec(
        'className="mt-1 flex text-xs md:hidden"',
      )?.[1],
    ).toBe("md");
    // `sm:not-sr-only` is not a hide, and `hidden sm:table-cell` is the
    // column's own class rather than a stand-in's.
    expect(
      /className="[^"]*\b(sm|md):hidden\b[^"]*"/.test(
        'className="sr-only sm:not-sr-only"',
      ),
    ).toBe(false);
  });
});
