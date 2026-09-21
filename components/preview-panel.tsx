import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { formatTime, formatWeekday } from "@/lib/format";

/**
 * What this dashboard will look like once the clinic has records in it.
 *
 * A clinic on its first morning otherwise reads a grid of zeroes and a
 * column of "nothing yet" sentences: a page that works perfectly and
 * says only that you have done nothing.
 *
 * This is the second shape it has had, and the first one failed for a
 * reason worth keeping. It was the loading skeleton's outline -- seven
 * tiles and four cards, all grey bars, no words. Two vets looked at it
 * independently and both said the same thing: "the page isn't
 * loading." The bars measured 1.33:1 in the light theme and 1.27:1 in
 * the dark against the card they sit on, where WCAG asks 3:1 of any
 * graphic that carries meaning -- so they were either meaningful and
 * failing, or decoration filling most of the screen. One of the vets
 * added the thing none of us could see from inside: the real panel's
 * charts and invoice boxes were not in that outline at all, so it was
 * not even a preview of the panel.
 *
 * So it says something now. Names, a weekday, a time.
 *
 * WHAT IT STILL MAY NOT SAY, and the boundary moved rather than
 * dissolved. No counter, no amount, no percentage, no chart silhouette.
 * The rule came from a vet who left a product after seeing 11 on screen
 * and 4 in the drawer -- "what made me leave was not that the number
 * was wrong, it was learning that a number COULD be wrong" -- and that
 * same vet drew this line: their story was a story about a COUNTER. A
 * date does not tell anyone that figures here are arbitrary; a total
 * does.
 *
 * NOTHING HERE IS A RECORD, and the protection is not the sentence at
 * the top. The vet was blunt about that: "a little badge is no
 * protection, I would not read it either." What protects is that these
 * rows go nowhere. They are not links, they are not in any list, they
 * do not answer a search, nothing is written to the database, and the
 * whole panel is gone the moment a real record exists -- the dashboard
 * only renders it while the clinic has no clients, no animals and no
 * visits.
 *
 * The names are checked, not chosen carefully. Twice now a name picked
 * for an example turned out to exist -- once in a real clinic, once in
 * our own seed script -- and the second time was after being warned
 * about the first. `preview-panel.test` is what stops a third: hand
 * checking did not work, and the answer to that is not more care.
 *
 * Held back by a dashed border and no shadow, and NOT by a fill. That
 * was tried and measured, and the numbers are the reason it is not
 * here -- read them before making this block "a bit more obvious".
 *
 * In the light theme, against the page: a muted fill is 1.11:1, the
 * dashed border is 1.21:1, and a REAL card's background is 1.10:1.
 * That last figure is the useful one. Surfaces in this product are not
 * told apart by their background at all; they are told apart by border
 * and shadow. So a fill buys almost nothing, and darkening the dashed
 * line would make this block stand out MORE than the real cards beside
 * it -- saying "this is not real" by making it look more real.
 *
 * The fill also costs the one signal that is working. `--muted-fg` is
 * 5.78:1 on card and 4.73:1 on muted, so filling the block trades the
 * text -- five times more visible than any border here, and the text
 * that carries the sentence doing the explaining -- for 1.11 of
 * surface. At 4.73 it is also sitting on the AA floor, where one step
 * darker breaks it and nothing on screen says so.
 *
 * Not opacity either: in the dark theme card and page are already close
 * (#161c18 against #0f1411) and opacity dissolves what little
 * separation there is. A dashed frame already means "nothing here yet"
 * in this codebase (`empty-state.tsx`).
 */

/**
 * The example week, as data rather than as markup.
 *
 * Names carry across both languages because names do not translate: a
 * Turkish clinic's animals are called these things whichever language
 * the vet reads the interface in. The day and the time do translate,
 * and go through `lib/format` like every other date in the product --
 * Turkish writes 09:30, English writes 9:30 AM, and a preview that got
 * that wrong would be teaching the reader the wrong shape.
 *
 * `inDays` rather than a fixed date: a written-out calendar day is a
 * claim about a day the clinic can go and check, and this is an
 * example of a week, not of a Tuesday in January.
 */
const EXAMPLE_WEEK = [
  { name: "Poyraz", inDays: 1, hour: 9, minute: 30 },
  { name: "Maviş", inDays: 1, hour: 14, minute: 0 },
  { name: "Lokum", inDays: 2, hour: 11, minute: 15 },
  { name: "Nazlı", inDays: 3, hour: 16, minute: 45 },
] as const;

export const EXAMPLE_NAMES = EXAMPLE_WEEK.map((row) => row.name);

export async function PreviewPanel() {
  const [t, locale] = await Promise.all([
    getTranslations("dashboard"),
    getLocale(),
  ]);

  const now = new Date();
  const rows = EXAMPLE_WEEK.map((row) => {
    const when = new Date(now);
    when.setDate(when.getDate() + row.inDays);
    when.setHours(row.hour, row.minute, 0, 0);
    return { name: row.name, when };
  });

  return (
    <div
      className={cn(
        surface,
        "flex flex-col gap-4 border-dashed p-6 shadow-none",
      )}
    >
      {/* Read, unlike the rows below it. Describing a shape to somebody
          who cannot see it is noise; telling them what this region is
          costs one sentence and there is no reason to withhold it.

          It also carries the whole explanation, which is why the mock's
          separate "example clinic" badge is not here: saying one fact
          in two places weakens both, and this sentence already does the
          badge's job and the caption's. */}
      <p className="text-sm text-muted-foreground">{t("previewNote")}</p>

      <ul
        // Not reachable, not selectable, not focusable, not announced:
        // nothing here is an action, and a tab stop on a picture of a
        // dashboard is a promise that something will happen.
        className="pointer-events-none select-none flex flex-col gap-3"
        aria-hidden="true"
      >
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground"
          >
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="shrink-0 tabular-nums">
              {formatWeekday(locale, row.when)} {formatTime(locale, row.when)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
