"use client";

/**
 * A live region that is already on the page before it has anything to say.
 *
 * The order matters and is the whole reason this exists. A live region only
 * speaks for content that arrives AFTER it mounts, so a `role="status"` box
 * rendered together with its first message is unreliable across screen
 * readers — the region and the text appear in the same commit, and there is
 * nothing for the reader to notice changing. Mounting the region empty and
 * writing into it later is the shape that works everywhere.
 *
 * `status` and not `alert`: everything announced here is a consequence of
 * something the user just did, and assertive would cut across the reader's
 * own speech for a fact they asked for. Politely queued is right.
 *
 * It does not replace `aria-describedby`. A description is read when focus
 * arrives at the control; this is for the moment the answer changes while
 * focus is ALREADY there — choosing a client and learning they cannot be
 * messaged, where the description is correct and silent because nothing
 * moved. Both channels, one string, given once by the caller.
 */
export function Announcer({ message }: { message: string | null }) {
  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  );
}
