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

/** JSX comments carry the reasoning and none of the markup. */
function markup(branch: string): string {
  return branch.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the screen an empty clinic meets", () => {
  it("draws the greeting and the ask, and nothing else", () => {
    const components = [
      ...new Set(markup(firstRunBranch()).match(/<([A-Z]\w+)/g) ?? []),
    ].map((tag) => tag.slice(1));

    // Not "at most two": the exact set. A third block here is how this
    // screen acquired a 226px example panel that could not be clicked
    // and answered a question the clinic had not asked, and the shape
    // of the next one is already named in `first-step-card.tsx` -- "now
    // switch on reminders", "now add your staff". The card refuses to
    // become a checklist internally; this refuses to let one be built
    // around it.
    expect(components.sort()).toEqual(["FirstStepCard", "PageHeader"]);
  });

  it("asks the card for the shape that makes it the subject", () => {
    // The screen and the card agree about which of the two shapes is
    // being drawn here. `first-step-card.test` holds what each shape
    // looks like; this holds which one this screen orders, because the
    // card cannot know it is alone on the page.
    expect(markup(firstRunBranch())).toContain('size="page"');
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
