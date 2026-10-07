// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Announcer } from "@/components/ui/announcer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const region = (c: HTMLElement) => c.querySelector('[role="status"]')!;

describe("announcing something that is also on screen", () => {
  // A live region only speaks for content that arrives after it mounts.
  // Rendered together with its first message it is unreliable across
  // screen readers, because the region and the text land in one commit
  // and there is nothing for the reader to notice changing.
  it("is on the page before it has anything to say", () => {
    const { container } = render(<Announcer message={null} />);
    expect(region(container)).not.toBeNull();
    expect(region(container).textContent).toBe("");
  });

  it("speaks when the message arrives", () => {
    const { container, rerender } = render(<Announcer message={null} />);
    rerender(<Announcer message="Gönderilmeyecek: telefon yok." />);
    expect(region(container).textContent).toBe("Gönderilmeyecek: telefon yok.");
  });

  /**
   * The half that is easy to miss, and the reason pm asked about it.
   *
   * What gets announced here is usually on screen too — a field's hint,
   * or the row the text was read out of. A region that keeps its message
   * leaves the same words in the accessibility tree twice, and someone
   * browsing the page meets both with nothing to say which is the copy.
   */
  it("empties itself once it has been read", () => {
    const { container } = render(<Announcer message="Kaydedildi." />);
    expect(region(container).textContent).toBe("Kaydedildi.");

    act(() => void vi.advanceTimersByTime(5000));
    expect(region(container).textContent).toBe("");
  });

  // Emptying must not make the region deaf to what comes next.
  it("speaks again for a different message after clearing", () => {
    const { container, rerender } = render(<Announcer message="Birinci." />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(region(container).textContent).toBe("");

    rerender(<Announcer message="İkinci." />);
    expect(region(container).textContent).toBe("İkinci.");
  });
});
