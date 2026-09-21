"use client";

import * as React from "react";
import { Announcer } from "@/components/ui/announcer";

/** How long the row stays tinted before fading back. */
const HOLD_MS = 2000;
/** Give up looking for the row after this; the list is server-rendered. */
const WAIT_MS = 3000;

/**
 * Take the reader to the row that was just created, and say what it says.
 *
 * The save sentence a vet asked for is not a new surface: the row already
 * carries "will be sent 2 Oct" or "will not be sent: no consent", and it is
 * already right, `dueNow` and all. Writing it a second time beside the form
 * would be the same fact in two places, one of which goes stale. What was
 * missing is that the eye never went there — the list is ordered by due
 * date and runs to a hundred rows, so a new reminder can land anywhere,
 * including off-screen.
 *
 * So: scroll to it, tint it briefly, and read its own sentence out. The
 * scroll is the part that does the work and the tint only confirms it; if
 * this ever has to be cut down, the tint goes first. Highlighting a row
 * nobody has scrolled to is emphasis nobody is looking at.
 *
 * Nothing takes focus. The vet is very likely typing the next reminder
 * into the form above, and pulling the caret out of it to celebrate the
 * last one would be worse than saying nothing at all.
 *
 * The row belongs to the server-rendered list, so this decorates a node it
 * does not own: it sets a data attribute the row's own class list already
 * styles, rather than trying to hold React state for a subtree from
 * outside it. The tint is a Tailwind `data-` variant and not a plain
 * `bg-*` class for a reason — two background utilities in one class list
 * are resolved by stylesheet order, not attribute order, so `bg-accent`
 * next to `bg-card` is a coin toss. A variant raises the specificity and
 * makes the answer definite.
 */
export function NewRowSpotlight({
  rowId,
  /** Read out of the row once it is found, so the sentence has one author. */
  sentenceSelector = "[data-delivery-sentence]",
}: {
  /** DOM id of the row to point at, or null when there is nothing new. */
  rowId: string | null;
  sentenceSelector?: string;
}) {
  // Keyed by the row it came from, so clearing it is a render-time
  // comparison rather than a second state write from inside the effect.
  const [found, setFound] = React.useState<{
    id: string;
    text: string | null;
  } | null>(null);
  const message = found?.id === rowId ? found.text : null;

  React.useEffect(() => {
    if (!rowId) return;
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    // The list is re-rendered from the server after the save, so the row
    // is not in the document yet when this runs. Poll on animation frames
    // rather than guessing a delay: a fixed wait is either too short on a
    // slow response or a visible pause on a fast one.
    const look = () => {
      if (cancelled) return;
      const row = document.getElementById(rowId);
      if (!row) {
        if (Date.now() - startedAt < WAIT_MS) requestAnimationFrame(look);
        return;
      }
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      row.scrollIntoView({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
      row.dataset.spotlight = "";
      // The row's own rendered text, not a sentence rebuilt here. The
      // screen and the announcement cannot disagree if only one of them
      // ever decided what to say.
      setFound({
        id: rowId,
        text: row.querySelector(sentenceSelector)?.textContent?.trim() ?? null,
      });
      holdTimer = setTimeout(() => {
        delete row.dataset.spotlight;
      }, HOLD_MS);
    };
    requestAnimationFrame(look);

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      // A second save while the first is still lit: hand the tint over
      // rather than leaving two rows claiming to be the new one.
      const previous = document.getElementById(rowId);
      if (previous) delete previous.dataset.spotlight;
    };
  }, [rowId, sentenceSelector]);

  return <Announcer message={message} />;
}
