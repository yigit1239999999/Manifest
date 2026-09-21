// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
}));

import { PreviewPanel } from "@/components/preview-panel";

/**
 * The preview is a picture of a dashboard, and every one of these is a
 * condition ux attached to it rather than a preference.
 */
describe("the panel a clinic sees before it has records", () => {
  it("draws its bars in a colour that survives the dark theme", async () => {
    const { container } = render(await PreviewPanel());
    const bars = [...container.querySelectorAll("div")].filter((d) =>
      /\bbg-(border|muted)\b/.test(d.className),
    );

    expect(bars.length).toBeGreaterThan(0);
    // `--muted` (#1f2521) on `--card` (#161c18) is very nearly nothing:
    // the bars would vanish and the preview would read as a grid of
    // empty boxes, which is worse than the zeroes it replaced. ux named
    // this one as the line between done and not done.
    for (const bar of bars) {
      expect(bar.className, "a bar using --muted disappears in the dark")
        .not.toMatch(/\bbg-muted\b/);
    }
  });

  // `animate-pulse` means "loading". A screen that pulses for ever says
  // the opposite of calm on the evening somebody has just finished
  // setting the product up.
  it("does not pretend to be loading", async () => {
    const { container } = render(await PreviewPanel());
    expect(container.innerHTML).not.toMatch(/animate-pulse|animate-/);
  });

  /**
   * The bars carry no meaning, so they are not read out; the sentence
   * above the panel carries it instead. And nothing here is an action,
   * so nothing here may be reached: a tab stop on a picture of a
   * dashboard promises something will happen when it is pressed.
   */
  it("is out of reach of both the keyboard and the screen reader", async () => {
    const { container } = render(await PreviewPanel());
    const root = container.firstElementChild!;

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.className).toContain("pointer-events-none");
    expect(container.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(
      0,
    );
  });

  /**
   * No crop of this panel may read as data.
   *
   * A vet left a product after seeing 11 on screen and 4 in the
   * drawer, and said what actually cost it: "not that the number was
   * wrong -- that I learned a number COULD be wrong." Once that is
   * learned about a panel, every future number on it is damaged. A
   * placeholder digit here is the cheapest possible way to teach it.
   *
   * The sibling rule cannot be tested from here and is held by the
   * shape instead: no chart silhouettes. Six bars of differing heights
   * under "revenue, last six months" claim something about revenue
   * with no figure beneath them at all, which is where wanting it to
   * look more real leads. The skeleton draws four list-shaped cards
   * and this copies them rather than improving on them.
   */
  it("contains no digit anywhere, placeholder or not", async () => {
    const { container } = render(await PreviewPanel());
    // Section titles are real text and may legitimately contain none;
    // what must not appear is a number standing where a figure goes.
    const bars = [...container.querySelectorAll("div")].filter((d) =>
      d.className.includes("bg-border"),
    );
    for (const bar of bars) {
      expect(bar.textContent, "a bar is carrying a figure").toBe("");
    }
    const titles = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(container.textContent).toBe(titles.join(""));
  });

  // Every counter tile carries the same two bars: identical shapes
  // cannot be read as one tile holding more of something than another.
  it("gives every counter tile the same two bars", async () => {
    const { container } = render(await PreviewPanel());
    const tiles = [...container.querySelectorAll(".h-24")];
    const shapes = tiles.map((t) =>
      [...t.children].map((c) => (c as HTMLElement).className).join("|"),
    );
    expect(tiles).toHaveLength(7);
    expect(new Set(shapes).size, "the tiles are not identical").toBe(1);
    expect(shapes[0]).not.toBe("");
  });

  // The shape is `DashboardSkeleton`'s to the box -- seven tiles and
  // four cards -- because matching it is what stops the page jumping
  // between what was shown while loading and what arrives after.
  it("keeps the shape the loading state already used", async () => {
    const { container } = render(await PreviewPanel());
    const tiles = container.querySelectorAll(".h-24");
    expect(tiles).toHaveLength(7);
    // Real, readable titles: the information is in them.
    expect(container.textContent).toContain(tr.dashboard.sections.recentVisits);
  });

  /**
   * Two cards stay out, and the guard is here because their absence
   * looks like an oversight.
   *
   * A placeholder under "revenue, last six months" sets up an
   * expectation of an amount whatever is drawn beneath it, and this
   * panel may say too little but not too much about money. The cost
   * is real and accepted: the preview describes the panel
   * incompletely, missing its two largest cards.
   */
  it("says nothing about money or volume", async () => {
    const { container } = render(await PreviewPanel());
    for (const title of [
      tr.dashboard.sections.revenueLast6Months,
      tr.dashboard.sections.visitsLast12Weeks,
    ]) {
      expect(container.textContent, `${title} sets up an expectation`)
        .not.toContain(title);
    }
  });

  // The order is the real panel's, and matching it is what lets a vet
  // find their first visit in the place the grey draft had held.
  it("keeps the order the real panel reads in", async () => {
    const { container } = render(await PreviewPanel());
    const shown = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(shown).toEqual([
      tr.dashboard.sections.upcomingAppointments,
      tr.dashboard.sections.recentVisits,
      tr.dashboard.sections.petsBySpecies,
      tr.dashboard.sections.upcomingVaccinations,
    ]);
  });
});
