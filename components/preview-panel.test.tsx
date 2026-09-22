// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
  getLocale: async () => "tr",
}));

import { PreviewPanel } from "@/components/preview-panel";

/**
 * The block is no longer a picture of anything, and every one of these
 * is a condition a vet attached to it rather than a preference.
 *
 * Half of the first-run conditions can be held by a test and half cannot,
 * and the next person needs to know which half they are standing on. The
 * split is written here because this is the larger of the two files that
 * hold any of them.
 *
 * Held here, so nobody can undo one quietly: no counter, amount or
 * percentage; no money or volume card; the rows carrying no link and no
 * tab stop; the rows hidden from a screen reader while the sentence
 * above them is not; no animation; the block describing where the first
 * visit leads rather than drawing an example record, so no name, date
 * or time appears in it at all; the order of those steps being carried
 * by something that is actually in the markup; the block never carrying
 * heavier type than the card above it, which is how the shape before
 * this one went wrong while passing every test here; and nothing inside
 * the dashed frame floating on a shadow of its own.
 *
 * The example-name guard that used to live at the bottom of this file
 * is gone, and the reason matters more than the deletion. Twice a name
 * we picked for an example turned out to be a real one -- once in a
 * clinic, once in our own seed script -- and the answer was a test
 * comparing our list against every file that prints names. There is no
 * list now: this shape draws no example at all. So the guard was turned
 * around rather than dropped, and what replaced it is wider than what
 * it replaced -- "no name may collide" became "nothing may be drawn
 * that did not come out of the catalogue", which the next person
 * putting an example back trips over on the first run. `first-step-card.test` holds the
 * card drawing one link at a time, the branch that falls back for a
 * reader who cannot write a visit, and the waiting sentence shown to a
 * reader who can reach neither -- both that it appears and that it
 * carries no button and no errand; `optional-details.test` holds what
 * may not be folded away in either form, including the consent question
 * the counter has to answer; `pet-picker-owner.test` holds the picker
 * naming an owner.
 *
 * Not held anywhere, and a violation of one ships silently: the focus
 * mark appearing at full contrast rather than fading in, which is a CSS
 * transition and so cannot be measured in jsdom at all -- a source scan
 * was considered and rejected, because the two utilities involved sit on
 * unrelated elements in the same file often enough that it would cry
 * wolf, and a guard that cries wolf is worse than the gap (see
 * `app/globals.css`, `transition-colors-no-focus-delay`); "no negative
 * sentence in the first-run state" -- which shipped violated, and is the
 * reason this list exists rather than a hypothetical -- and "the same
 * geometry, read differently", which lives in a measurement pm takes. The
 * sentences these tests read come out of `tr.json`, so a test can catch a
 * missing sentence and never a bad one; the quality of the words is ux's
 * job and cannot be moved here without writing a test that lies about
 * what it checks.
 *
 * Both lists are updated when a condition is agreed, not once the work
 * around it is finished, because an inventory is only true on the day it
 * is written and this one has a known expiry: hide-and-undo arrives with
 * conditions of its own, and a list nobody extends goes on claiming
 * cover over a set that no longer includes the feature. A condition is
 * not agreed until it is known which list it joins -- either a test holds
 * it or somebody has to look -- and which of the two it is matters as
 * much as the condition.
 */
describe("the panel a clinic sees before it has records", () => {
  it("says nothing that could be read as a figure", async () => {
    const { container } = render(await PreviewPanel());
    const said = container.textContent ?? "";

    // The line the vet drew themselves, and the reason it is here rather
    // than "no digits at all": their story -- 11 on the screen, 4 in the
    // drawer -- was a story about a COUNTER. A weekday and a clock do not
    // tell anyone that figures in this product are arbitrary. A total
    // does, and so does a percentage.
    expect(said).not.toMatch(/%/);
    expect(said).not.toMatch(/[₺$€]|\bTL\b/);
  });

  it("draws no chart, and no shape that stands in for one", async () => {
    const { container } = render(await PreviewPanel());

    expect(container.querySelector("svg")).toBeNull();
    // Six bars of differing heights under a revenue heading is a claim
    // about revenue whether or not a figure sits beneath them, which is
    // where an instinct to "make it look more real" leads.
    expect(container.querySelectorAll('[class*="h-"][class*="bg-"]')).toHaveLength(
      0,
    );
  });

  it("says nothing about money or volume", async () => {
    const { container } = render(await PreviewPanel());
    const said = container.textContent ?? "";

    for (const heading of [
      tr.dashboard.sections.revenueLast6Months,
      tr.dashboard.sections.visitsLast12Weeks,
    ]) {
      expect(said).not.toContain(heading);
    }
  });

  it("draws no example record: nothing but its own sentences", async () => {
    const { container } = render(await PreviewPanel());

    // The guard that replaced the example-name list. Everything the
    // block says has to come out of the catalogue, and what is left
    // over once those sentences are removed may only be the arrows and
    // whitespace. A name, a date, a clock or a figure put back here is
    // left over, and this fails on the first run.
    const chain = Object.values(tr.dashboard.previewChain);
    const written = [
      tr.dashboard.previewNote,
      ...chain.map((step) => step.term),
      ...chain.map((step) => step.result),
    ];

    let rest = container.textContent ?? "";
    for (const sentence of written) rest = rest.split(sentence).join("");

    expect(rest.replace(/[\u2193\s]/g, "")).toBe("");
  });

  it("carries the order in the markup, not only in the eye", async () => {
    const { container } = render(await PreviewPanel());

    // Order is the entire content: the draft of this block had the
    // reminder growing out of a date and the appointment out of the
    // reminder, which is backwards in this product. It is drawn with a
    // glyph because an icon and a drawn rule are both barred here, so
    // the glyph is the only thing carrying it -- and a rewrite that
    // loses it loses the meaning while still looking like a list.
    const steps = container.querySelectorAll("li");
    expect(steps).toHaveLength(4);
    expect(container.textContent?.match(/\u2193/g)).toHaveLength(
      steps.length - 1,
    );
  });

  it("is never the heaviest thing on the screen", async () => {
    const { container } = render(await PreviewPanel());

    // The fault that was invisible in review: borrowing the real card's
    // title made the preview the heaviest type on a page whose whole
    // job is to ask for one visit, so the example outweighed the
    // errand. The ceiling is the weight the card itself uses.
    expect(container.innerHTML).not.toContain("text-lg");
    expect(container.innerHTML).not.toContain("font-semibold");
    expect(container.innerHTML).not.toContain("font-bold");
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
  });

  it("does not pretend to be loading", async () => {
    const { container } = render(await PreviewPanel());

    // Two vets read the previous version -- an outline of grey bars --
    // and both said "the page isn't loading". A permanent pulse says the
    // same thing louder.
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.innerHTML).not.toContain("animate-pulse");
  });

  it("goes nowhere, which is the only protection that works", async () => {
    const { container } = render(await PreviewPanel());

    // "A little badge is no protection, I would not read it either."
    // What keeps these rows from being mistaken for records is that
    // there is nothing to do with them.
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
  });

  it("tells a screen reader what this is, and spares it the shape", async () => {
    const { container } = render(await PreviewPanel());

    const note = container.querySelector("p")!;
    expect(note.textContent).toBe(tr.dashboard.previewNote);
    expect(note.closest("[aria-hidden]")).toBeNull();

    // The rows are form, and describing a shape to somebody who cannot
    // see it is noise. Withholding what the region IS would not be.
    expect(container.querySelector("ul")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("is held back by a dashed frame rather than by opacity", async () => {
    const { container } = render(await PreviewPanel());
    const frame = container.firstElementChild as HTMLElement;

    expect(frame.className).toContain("border-dashed");
    expect(frame.className).toContain("shadow-none");
    // And held back by neither a fill nor opacity, both of which were
    // tried. A muted fill measures 1.11:1 against the page where a real
    // card's own background measures 1.10 -- surfaces here are not told
    // apart by background at all -- while costing the text 5.78:1 down
    // to 4.73:1, which is the AA floor. Opacity dissolves the little
    // separation the dark theme has (#161c18 on #0f1411).
    expect(frame.className).not.toMatch(/\bbg-muted\b/);
    expect(frame.className).not.toMatch(/\bopacity-/);

    // And nothing inside it floats either. A `Card` carries its own
    // `shadow-sm`, and real cards on this page are told apart from this
    // block by shadow -- filling the frame with cards would invert the
    // one signal saying it is not real.
    expect(container.querySelector('[class*="shadow-sm"]')).toBeNull();
  });
});
