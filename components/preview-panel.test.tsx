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
});
