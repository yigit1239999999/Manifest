// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { IntakeReceipt } from "@/components/intake-receipt";

/**
 * One sentence, one live region.
 *
 * Both halves of this box were live regions and nobody could see it:
 * `Callout` announces by default and `Announcer` is one by definition,
 * so the same words sat in a `role="status"` INSIDE another
 * `role="status"`. pm's mutation record showed the receipt twice. Two
 * copies of one fact is not twice the information -- it is the same
 * sentence read over the top of whatever the reader was doing, which
 * is the rule the consent row was fixed for.
 *
 * The one that stays is the announcer, because it is the one that
 * works: a live region only speaks for text that arrives AFTER it
 * mounts, and the box is painted with its words already in it.
 *
 * The words may appear twice in the DOM -- that is the point, one
 * string for the eye and one for the ear. What may not appear twice is
 * the region.
 */
describe("the receipt on a visit that made records", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const said = "Bu vizitle birlikte Limon ve sahibi Ayşe açıldı.";

  it("has exactly one live region, and it is not the box", () => {
    const { container } = render(<IntakeReceipt said={said} />);

    const live = container.querySelectorAll(
      '[role="status"], [role="alert"], [aria-live]',
    );

    expect(live).toHaveLength(1);
    // The announcer, which is the one that can actually speak: it
    // mounts empty and is written into a frame later.
    expect(live[0].textContent).toBe("");
    // And the visible sentence is not inside a region at all, which
    // is the claim rather than "the box has no class": a region
    // wrapping painted words is exactly what got read twice.
    expect(screen.getByText(said).closest('[role="status"]')).toBeNull();
  });

  it("still says it in words the eye can read", () => {
    render(<IntakeReceipt said={said} next="Yarın arayın." />);

    expect(screen.getByText(said)).toBeTruthy();
    expect(screen.getByText("Yarın arayın.")).toBeTruthy();
  });
});
