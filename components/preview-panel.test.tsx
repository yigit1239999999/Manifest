// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
  getLocale: async () => "tr",
}));

import { EXAMPLE_NAMES, PreviewPanel } from "@/components/preview-panel";

/**
 * The preview is a picture of a dashboard, and every one of these is a
 * condition a vet attached to it rather than a preference.
 *
 * Half of the first-run conditions can be held by a test and half cannot,
 * and the next person needs to know which half they are standing on. The
 * split is written here because this is the larger of the two files that
 * hold any of them.
 *
 * Held here, so nobody can undo one quietly: no counter, amount or
 * percentage; no money or volume card; the rows carrying no link and no
 * tab stop; the rows hidden from a screen reader while the sentence
 * above them is not; the block naming the one card it draws, in that
 * card's own words, and naming it without becoming a heading; no
 * animation; and the example names not existing anywhere the product's
 * own data does. `first-step-card.test` holds the
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

  it("names the one card it is a picture of", async () => {
    const { container } = render(await PreviewPanel());
    const said = container.textContent ?? "";

    // The whole reason this version exists: twice a reader was told
    // "this is how your panel will look" over a block that is not a
    // panel. The block draws one card, so it says which one -- in the
    // card's own words, read from the key the dashboard passes to its
    // own title, so a rename cannot leave the two disagreeing.
    expect(said).toContain(tr.dashboard.sections.upcomingAppointments);

    // Part of the picture, not of the document. A heading here would put
    // a stop in a screen reader's heading list pointing at four animals
    // that do not exist -- the same broken promise a tab stop would be,
    // one channel over.
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(
      container.querySelector("ul")!.previousElementSibling,
    ).toHaveAttribute("aria-hidden", "true");
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
  });
});

/**
 * The guard that exists because care did not work.
 *
 * An example name that turns out to be a real one is the exact thing the
 * preview is built to avoid: a reader meeting their own animal in a
 * panel that is not their data. It has now happened twice -- once with
 * names a vet recognised from their own clinic, and once with a name
 * sitting in our own seed script -- and the second time was after we had
 * been warned about the first.
 *
 * So the names are checked rather than chosen carefully, and the check
 * is against the files that actually put names in front of somebody: the
 * seed script the development database is built from, and the message
 * catalogues. A list without this test collides again within months, and
 * the collision is invisible on the day it happens.
 */
describe("the example names", () => {
  const sources = {
    "scripts/seed-states.mjs": readFileSync("scripts/seed-states.mjs", "utf8"),
    "messages/tr.json": readFileSync("messages/tr.json", "utf8"),
    "messages/en.json": readFileSync("messages/en.json", "utf8"),
  };

  it("are not names the product uses anywhere else", () => {
    expect(EXAMPLE_NAMES.length).toBeGreaterThan(0);

    for (const name of EXAMPLE_NAMES) {
      for (const [file, text] of Object.entries(sources)) {
        expect(
          text.includes(name),
          `${name} already appears in ${file}`,
        ).toBe(false);
      }
    }
  });

  it("are all actually on screen, so the check covers what is shown", async () => {
    const { container } = render(await PreviewPanel());
    const said = container.textContent ?? "";

    for (const name of EXAMPLE_NAMES) {
      expect(said).toContain(name);
    }
  });
});
