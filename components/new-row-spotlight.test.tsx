// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { NewRowSpotlight } from "@/components/new-row-spotlight";

/**
 * The save sentence a vet asked for is the row's own sentence; what was
 * missing was that their eye never went there. So this points at the row
 * and reads it back, and every claim in that description is one this file
 * has to hold — none of it is visible to a type checker and the component
 * does its work on a node it does not own.
 */

// jsdom has neither, and the component reaches for both.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.useFakeTimers();
  // Frames, so the "wait for the server-rendered row" loop can be driven.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 16) as unknown as number,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function placeRow(id: string, sentence: string) {
  const li = document.createElement("li");
  li.id = id;
  li.innerHTML = `<span data-delivery-sentence>${sentence}</span>`;
  document.body.append(li);
  return li;
}

const settle = () => act(() => void vi.advanceTimersByTime(50));

describe("pointing at the row that was just created", () => {
  it("scrolls to it, tints it, and reads its own sentence", () => {
    const row = placeRow("reminder-r1", "Gönderilecek: 2 Eki 09:00 · SMS");
    const { container } = render(<NewRowSpotlight rowId="reminder-r1" />);
    settle();

    expect(row.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "smooth",
    });
    expect(row.dataset.spotlight).toBe("");
    // The row's own words, not a second sentence composed here: the
    // screen and the announcement cannot disagree if only one of them
    // ever decided what to say.
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Gönderilecek: 2 Eki 09:00 · SMS",
    );
  });

  // It must not stay. Otherwise the third reminder is written with the
  // first one still lit, and a permanent mark is not a mark.
  it("lets the tint go, and keeps the sentence available", () => {
    const row = placeRow("reminder-r1", "Gönderilecek: 2 Eki 09:00 · SMS");
    const { container } = render(<NewRowSpotlight rowId="reminder-r1" />);
    settle();
    expect(row.dataset.spotlight).toBe("");

    act(() => void vi.advanceTimersByTime(2500));
    expect(row.dataset.spotlight).toBeUndefined();
    expect(container.querySelector('[role="status"]')?.textContent).not.toBe("");
  });

  // The list is re-rendered from the server after the save, so the row is
  // not in the document when this first runs. A fixed delay would be too
  // short on a slow response and a visible pause on a fast one.
  it("waits for a row the server has not sent yet", () => {
    render(<NewRowSpotlight rowId="reminder-late" />);
    settle();

    const row = placeRow("reminder-late", "Gönderilmeyecek: telefon yok.");
    settle();

    expect(row.dataset.spotlight).toBe("");
    expect(row.scrollIntoView).toHaveBeenCalled();
  });

  it("gives up rather than searching forever", () => {
    render(<NewRowSpotlight rowId="reminder-never" />);
    act(() => void vi.advanceTimersByTime(4000));

    const row = placeRow("reminder-never", "Gönderilecek.");
    settle();
    expect(row.dataset.spotlight).toBeUndefined();
  });

  // Two rows both claiming to be the new one is worse than neither: the
  // mark stops meaning "this is the one you just wrote".
  it("hands the tint over on a second save", () => {
    const first = placeRow("reminder-a", "Gönderilecek: 2 Eki.");
    const second = placeRow("reminder-b", "Gönderilmeyecek: onay yok.");
    const view = render(<NewRowSpotlight rowId="reminder-a" />);
    settle();
    expect(first.dataset.spotlight).toBe("");

    view.rerender(<NewRowSpotlight rowId="reminder-b" />);
    settle();
    expect(first.dataset.spotlight).toBeUndefined();
    expect(second.dataset.spotlight).toBe("");
  });

  it("does nothing at all before anything has been saved", () => {
    const row = placeRow("reminder-r1", "Gönderilecek.");
    const { container } = render(<NewRowSpotlight rowId={null} />);
    settle();

    expect(row.scrollIntoView).not.toHaveBeenCalled();
    expect(row.dataset.spotlight).toBeUndefined();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  });

  // Someone who has asked not to be moved around still gets taken there;
  // what they do not get is the journey.
  it("skips the animation when motion is not wanted", () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const row = placeRow("reminder-r1", "Gönderilecek.");
    render(<NewRowSpotlight rowId="reminder-r1" />);
    settle();

    expect(row.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "auto",
    });
  });
});
