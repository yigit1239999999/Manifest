"use client";

import * as React from "react";
import { Callout } from "@/components/ui/callout";
import { Announcer } from "@/components/ui/announcer";

/**
 * What the save just made, said once on the page it landed on.
 *
 * A visit written from the single-screen form can create three records
 * in one press, and two of them are records the vet never saw a page
 * for. The visit's own page already names the animal and the owner --
 * what it cannot say, because it is true of the SAVE and not of the
 * record, is that those two were born here. That is the one fact worth
 * a sentence, and it is the reason this is not simply left to the page.
 *
 * ONE sentence with one author. The box and the live region are handed
 * the same strings rather than each getting their own wording: two
 * copies of one fact is not twice the information, and the copy nobody
 * can see is the one that goes stale.
 *
 * It says itself once. The flag comes out of the address as soon as the
 * sentence is on screen, so a reload, a bookmark or a back does not
 * report a save that happened yesterday -- and the words stay where
 * they are for the reader who is looking at them now, because taking
 * the parameter out is a history edit and not a navigation
 * (`window.history.replaceState`, which this version of Next routes
 * through its own router).
 */
export function IntakeReceipt({
  /** The receipt itself. Never empty when this is rendered at all. */
  said,
  /**
   * What to do with it tomorrow, for the clinic whose first findable
   * record this is. Absent from the second animal onwards -- a lesson
   * repeated is a lesson nobody reads.
   *
   * The same box rather than a second one: both are true at the same
   * moment on a first morning, and two info boxes stacked on one screen
   * is how neither of them gets read.
   */
  next,
}: {
  said: string;
  next?: string;
}) {
  const [spoken, setSpoken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("created");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);

    // A live region only speaks for text that arrives AFTER it mounts
    // (`Announcer`), so the sentence is handed over a frame later. The
    // gap is the mechanism rather than a delay.
    const frame = requestAnimationFrame(() =>
      setSpoken([said, next].filter(Boolean).join(" ")),
    );
    return () => cancelAnimationFrame(frame);
  }, [said, next]);

  return (
    <>
      {/* `live="none"`, and the `Announcer` outside rather than in.

          Both were live regions: a `Callout` announces by default and
          the announcer is one by definition, so the same sentence sat
          in a `role="status"` inside another `role="status"` and pm's
          mutation record showed it twice. Two copies of one fact is
          not twice the information; it is the same sentence read
          twice, over the top of whatever the reader was doing.

          The one that stays is the announcer, because it is the one
          that works: a live region only speaks for text that arrives
          AFTER it mounts, and the box is painted with its words
          already in it. Nested, it also breaks the rule the consent
          row was fixed for -- one channel per sentence. */}
      <Callout variant="info" live="none">
        <span className="flex flex-col gap-1">
          <span>{said}</span>
          {next && <span className="text-muted-foreground">{next}</span>}
        </span>
      </Callout>
      <Announcer message={spoken} />
    </>
  );
}
