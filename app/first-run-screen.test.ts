import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The screen a clinic meets before it has anything, held as a screen
 * rather than as a pile of components.
 *
 * Everything else about this branch is guarded one component down --
 * `first-step-card.test` holds the card's two shapes and its weights,
 * `preview-panel.test` holds what the example block may never say. Both
 * were green on the day the owner called this screen stale, and they
 * still would be: each part obeyed its own rule and the SCREEN was the
 * thing nobody was checking. What went wrong was a relation between two
 * components, which is exactly what a component test cannot see.
 *
 * The relation, in one sentence (ux, as the falsifiable half of ui's
 * rule): on the first-run screen the ask is the heaviest thing in the
 * content area apart from the greeting. The greeting is the one
 * exception and it is deliberate -- `h1` at `text-2xl font-semibold`
 * says whose screen this is, the card says what to do, and levelling
 * them loses that distinction (ui's K3 asks for the card to sit UNDER
 * the greeting, so a rule with no exception would contradict it).
 *
 * Read from the source rather than rendered, and the trade is worth
 * stating. Rendering would need a session, a clinic and eight queries
 * stubbed, and would then assert about the same JSX this reads. What it
 * would catch that this does not: a heavy class arriving from inside a
 * component this branch renders. What this catches that a render would
 * not, unless somebody remembered to extend it: a NEW block added to
 * the branch -- which is how the screen got its example panel in the
 * first place, and how it would get a "set up reminders" card next.
 *
 * So the two halves live in different places on purpose: weights inside
 * the components that own them, membership here.
 */

const source = readFileSync(
  fileURLToPath(new URL("./(app)/(overview)/page.tsx", import.meta.url)),
  "utf8",
);

/**
 * The `if (firstRun)` return, from its opening line to the closing
 * brace of the branch.
 *
 * Anchored on the condition rather than on line numbers: the branch has
 * moved twice in two days, and a test pinned to `:260-270` would either
 * follow it by hand or quietly start reading the wrong code.
 */
function firstRunBranch(): string {
  const start = source.indexOf("if (firstRun) {");
  expect(start, "the first-run branch has been renamed or removed").toBeGreaterThan(
    -1,
  );
  const end = source.indexOf("\n  }", start);
  return source.slice(start, end);
}

/**
 * The branch with its reasoning taken out, in both forms it is written
 * in: `{/* … *\/}` between elements and `//` lines inside a JSX
 * attribute list.
 *
 * The second one was missed at first and the miss was invisible: the
 * placement assertion looked for `pb-` and found it in a COMMENT
 * explaining `pb-16`, so removing the class from the element left the
 * test green. A rule that reads its own explanation instead of the
 * code is the shape TEAM.md calls a test that is green for the wrong
 * reason -- caught here only because the mutation was run.
 *
 * Only whole comment lines are dropped, so a `//` inside a string --
 * a URL, say -- is left where it is.
 */
function markup(branch: string): string {
  return branch
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("the screen an empty clinic meets", () => {
  // pm B14, and the user's call: the spreadsheet is not a footnote under
  // the visit card but a second card at the same weight. Two doors to one
  // place -- a clinic with records in it -- and nothing else: no third
  // card, no checklist (that is `SetupStepsCard`, after the records are in).
  it("draws the greeting and two equal asks: bring the records, or open a visit", () => {
    const branch = markup(firstRunBranch());
    const components = [...new Set(branch.match(/<([A-Z]\w+)/g) ?? [])].map(
      (tag) => tag.slice(1),
    );

    expect(components.sort()).toEqual(["FirstStepCard", "PageHeader"]);
    const cards = branch.match(/<FirstStepCard[^>]*>/g) ?? [];
    expect(cards).toHaveLength(2);
    expect(cards.some((c) => c.includes('need="import"'))).toBe(true);
    expect(cards.some((c) => c.includes('need="visit"'))).toBe(true);
  });

  it("gives both asks the shape that makes them the subject", () => {
    const cards = markup(firstRunBranch()).match(/<FirstStepCard[^>]*>/g) ?? [];
    expect(cards.every((c) => c.includes('size="page"'))).toBe(true);
  });

  it("invents nothing: no counter, amount, percentage or chart", () => {
    const branch = markup(firstRunBranch());

    // Inherited from `preview-panel.test`, which went with the block it
    // guarded. The block is gone; the rule it enforced is not, because
    // the rule was never about that component.
    //
    // It came from a vet who left a product after seeing 11 on one
    // screen and 4 in the drawer: "what made me leave was not that the
    // number was wrong, it was learning that a number COULD be wrong."
    // A clinic with no records has nothing true to count, so anything
    // countable drawn here is invented -- and the first screen is the
    // worst place in the product to teach that a figure might be made
    // up.
    //
    // The other guards on that block retired with it, and each was
    // about the block being a PICTURE: the dashed frame, the
    // `aria-hidden` rows, `pointer-events-none`, the arrow count, the
    // example-name collision check. There is no picture now, so there
    // is nothing for them to hold.
    expect(branch).not.toMatch(/<(svg|ColumnBars|HorizontalBars)\b/);
    expect(branch).not.toMatch(/[%\u20ba$\u20ac]/);
    // A figure typed straight into the markup, which is what a "3
    // records" line would look like arriving here.
    expect(branch).not.toMatch(/>\s*\d/);
    // A drawn bar: a height and a fill on one element. A silhouette of
    // a chart is a claim about data even with no number beside it.
    expect(branch).not.toMatch(/\bh-[\w.[\]-]+\s+[^"]*\bbg-/);
  });

  it("places the content instead of parking it in a corner", () => {
    const branch = markup(firstRunBranch());

    // The screen held one greeting and one card in the top-left of
    // roughly 976x800, and ui read it as a page cut off early rather
    // than a page with one thing on it. Centring does not fill the
    // emptiness -- nothing honest fills it -- it makes the emptiness
    // deliberate.
    expect(branch).toContain("items-center");
    expect(branch).toContain("justify-center");
    // A field to centre in. Without a height the centring is a no-op
    // and the block sits back in the corner with the classes still on
    // it, which is the version of this that passes review by looking
    // right in the diff.
    expect(branch).toMatch(/min-h-/);
    // Above the true middle. `justify-center` alone puts a lone object
    // lower than the eye expects a subject to sit.
    expect(branch).toMatch(/\bpb-\d+/);
    // One column, so the greeting and the card share a left edge --
    // two blocks of different widths centred separately are each
    // centred and together look misaligned.
    expect(branch).toMatch(/\bmax-w-/);
  });

  it("puts no weight of its own beside the card", () => {
    // ux's guard, and the falsifiable half of "the primary ask may not
    // be drawn lighter than the secondary text beside it": the branch
    // itself may not draw emphasised text. A sentence added here at
    // `font-medium` would sit beside an ask at `font-semibold` and
    // start the same inversion over -- three times found in two days,
    // which is why this is a test and not a note.
    //
    // The greeting is not caught because its weight lives in
    // `page-header.tsx`, which is the exception this rule wants: the
    // `h1` is the one thing on the screen that may outweigh the ask.
    const heavy = markup(firstRunBranch()).match(
      /font-(medium|semibold|bold)|text-(lg|xl|2xl|3xl)/g,
    );
    expect(heavy ?? []).toEqual([]);
  });
});
