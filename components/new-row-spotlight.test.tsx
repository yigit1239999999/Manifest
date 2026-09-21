// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

// `MutationObserver` delivers on a microtask, which fake timers do not
// flush, so the queue has to be drained as well as the clock advanced.
const settle = async () =>
  act(async () => {
    vi.advanceTimersByTime(50);
    await Promise.resolve();
  });

describe("pointing at the row that was just created", () => {
  it("scrolls to it, tints it, and reads its own sentence", async () => {
    const row = placeRow("reminder-r1", "Gönderilecek: 2 Eki 09:00 · SMS");
    const { container } = render(<NewRowSpotlight rowId="reminder-r1" />);
    await settle();

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
  it("lets the tint go, and keeps the sentence available", async () => {
    const row = placeRow("reminder-r1", "Gönderilecek: 2 Eki 09:00 · SMS");
    const { container } = render(<NewRowSpotlight rowId="reminder-r1" />);
    await settle();
    expect(row.dataset.spotlight).toBe("");

    act(() => void vi.advanceTimersByTime(2500));
    expect(row.dataset.spotlight).toBeUndefined();
    expect(container.querySelector('[role="status"]')?.textContent).not.toBe("");
  });

  // The list is re-rendered from the server after the save, so the row is
  // not in the document when this first runs. A fixed delay would be too
  // short on a slow response and a visible pause on a fast one.
  it("waits for a row the server has not sent yet", async () => {
    render(<NewRowSpotlight rowId="reminder-late" />);
    await settle();

    // Well past every deadline this component has been given so far.
    act(() => void vi.advanceTimersByTime(20000));
    const row = placeRow("reminder-late", "Gönderilmeyecek: telefon yok.");
    await settle();

    expect(row.dataset.spotlight).toBe("");
    expect(row.scrollIntoView).toHaveBeenCalled();
  });

  it("gives up rather than searching forever", async () => {
    render(<NewRowSpotlight rowId="reminder-never" />);
    // Past the cap, which bounds the row that never arrives -- a
    // reminder saved under the "closed" filter goes into a list this
    // page is not showing -- and NOT how slow a server may be. pm
    // measured a real row landing at 17.4s, which is why the previous
    // 15s answer was the same mistake a second time.
    act(() => void vi.advanceTimersByTime(61000));

    const row = placeRow("reminder-never", "Gönderilecek.");
    await settle();
    expect(row.dataset.spotlight).toBeUndefined();
  });

  // Two rows both claiming to be the new one is worse than neither: the
  // mark stops meaning "this is the one you just wrote".
  it("hands the tint over on a second save", async () => {
    const first = placeRow("reminder-a", "Gönderilecek: 2 Eki.");
    const second = placeRow("reminder-b", "Gönderilmeyecek: onay yok.");
    const view = render(<NewRowSpotlight rowId="reminder-a" />);
    await settle();
    expect(first.dataset.spotlight).toBe("");

    view.rerender(<NewRowSpotlight rowId="reminder-b" />);
    await settle();
    expect(first.dataset.spotlight).toBeUndefined();
    expect(second.dataset.spotlight).toBe("");
  });

  it("does nothing at all before anything has been saved", async () => {
    const row = placeRow("reminder-r1", "Gönderilecek.");
    const { container } = render(<NewRowSpotlight rowId={null} />);
    await settle();

    expect(row.scrollIntoView).not.toHaveBeenCalled();
    expect(row.dataset.spotlight).toBeUndefined();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  });

  // Someone who has asked not to be moved around still gets taken there;
  // what they do not get is the journey.
  it("skips the animation when motion is not wanted", async () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const row = placeRow("reminder-r1", "Gönderilecek.");
    render(<NewRowSpotlight rowId="reminder-r1" />);
    await settle();

    expect(row.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "auto",
    });
  });
});

/**
 * The attribute and the rule that paints it have to exist together.
 *
 * pm found both halves broken at once and the pair is the lesson: the
 * component set an attribute nothing styled, and the utility that would
 * have styled it was not in the stylesheet at all. A test reading class
 * names would have passed on both. This one reads the two ends and
 * checks they meet.
 *
 * It asserts the CSS by looking in `globals.css`, which is only possible
 * because the rule was moved there by hand (ux). While it lived as a
 * `data-[spotlight]:bg-accent` utility on the element, whether it
 * existed depended on what a build chose to generate — unknowable from
 * here, and, as it turned out, wrong.
 *
 * WHAT IT DOES NOT CHECK: that the browser paints anything. It checks
 * that the attribute this component writes is the attribute the
 * stylesheet selects on. Only a browser can do the rest.
 */
describe("the mark and the rule that paints it", () => {
  it("styles the attribute the component actually sets", async () => {
    const css = await readFile(resolve("app/globals.css"), "utf8");
    // The same string the component writes via `row.dataset.spotlight`.
    expect(css).toMatch(/\[data-spotlight\]\s*\{[^}]*background-color/);
  });
});
