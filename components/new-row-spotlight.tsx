"use client";

import * as React from "react";
import { Announcer } from "@/components/ui/announcer";

/** How long the row stays tinted once the reader has arrived at it. */
const HOLD_MS = 2000;
/**
 * How long to wait for a smooth scroll before starting that countdown
 * anyway.
 *
 * `scrollend` is the real signal, but it never fires when no scroll was
 * needed -- the row was already on screen -- so something has to start
 * the clock in that case too. Whichever happens first wins.
 */
const SCROLL_SETTLE_MS = 700;
/**
 * Stop watching for a row that is never coming.
 *
 * This is NOT a budget for how slow the server may be, and the
 * distinction is the whole history of this constant. It was three
 * seconds of animation frames, then fifteen seconds of observation, and
 * pm then measured the row arriving at SEVENTEEN POINT FOUR -- so the
 * second guess would have failed exactly like the first, and for the
 * same reason: a deadline on someone else's round trip is a guess
 * wearing a timeout's clothes.
 *
 * The observer needs no deadline for slowness; it answers whenever the
 * row lands. What it needs a stop for is the row that never lands at
 * all -- a reminder saved while the "closed" filter is on goes straight
 * into a list this page is not showing. This bounds that case and
 * nothing else, which is why it is a minute rather than a number tuned
 * against a server.
 */
const WAIT_MS = 60000;

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
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const take = (row: HTMLElement) => {
      observer?.disconnect();
      if (giveUpTimer) clearTimeout(giveUpTimer);
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

      // The two seconds are counted from ARRIVAL, not from the start of
      // the journey. pm measured a new row at 3043px, and a smooth
      // scroll over that takes longer than half a second: counted from
      // here, a good part of the mark would burn before the reader sees
      // it, and the worst version has the colour beginning to fade at
      // the exact moment the row comes into view (ux).
      let started = false;
      const startHold = () => {
        if (started) return;
        started = true;
        window.removeEventListener("scrollend", startHold);
        holdTimer = setTimeout(() => {
          delete row.dataset.spotlight;
        }, HOLD_MS);
      };
      if (reduced) {
        // Nothing to wait for: the jump already happened.
        startHold();
      } else {
        window.addEventListener("scrollend", startHold, { once: true });
        settleTimer = setTimeout(startHold, SCROLL_SETTLE_MS);
      }
    };

    // The row is not in the document yet: the list is re-rendered from
    // the server after the save. Watch for it rather than polling on a
    // deadline -- an observer answers the moment it arrives, however
    // long that takes, where a timeout has to guess how long is
    // reasonable and is wrong in one direction or the other.
    const existing = document.getElementById(rowId);
    if (existing) {
      take(existing);
    } else {
      observer = new MutationObserver(() => {
        const row = document.getElementById(rowId);
        if (row) take(row);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      giveUpTimer = setTimeout(() => observer?.disconnect(), WAIT_MS);
    }

    return () => {
      observer?.disconnect();
      if (holdTimer) clearTimeout(holdTimer);
      if (settleTimer) clearTimeout(settleTimer);
      if (giveUpTimer) clearTimeout(giveUpTimer);
      // A second save while the first is still lit: hand the tint over
      // rather than leaving two rows claiming to be the new one.
      const previous = document.getElementById(rowId);
      if (previous) delete previous.dataset.spotlight;
    };
  }, [rowId, sentenceSelector]);

  return <Announcer message={message} />;
}
