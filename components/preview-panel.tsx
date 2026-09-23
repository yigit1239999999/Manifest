import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";

/**
 * Where the first visit leads.
 *
 * NOTHING RENDERS THIS TODAY, and that is a decision rather than an
 * oversight -- read this before deleting it as dead code. It was on the
 * first-run dashboard until ui measured that screen: the block was the
 * largest object on it (226px against the card's 76px), nothing in it
 * could be clicked, and it answered a question nobody had asked yet.
 * Four links about invoices, appointments and reminders mean little to
 * a clinic that has no animal on file. The screen now asks for the one
 * thing it wants, and this moves to the moment the chain becomes true:
 * after the first visit is saved. That move is its own task and is
 * owned by ux; it is not written yet, so this file and its ten guards
 * wait here rather than being deleted and argued for again later.
 *
 * `preview-panel.test.tsx` still renders it directly, so every one of
 * those guards is live. If the move is abandoned, the component and the
 * tests go together and the reasons in both are answered one by one --
 * a guard deleted along with its component is a price quietly refunded
 * (ux).
 *
 * What it was written for, on a dashboard that has nothing in it yet:
 *
 * A clinic on its first morning otherwise reads a grid of zeroes and a
 * column of "nothing yet" sentences: a page that works perfectly and
 * says only that you have done nothing.
 *
 * This is the third shape, and the first two failed in the same place.
 * Both were pictures of the dashboard.
 *
 * The first was the loading skeleton's outline -- seven tiles and four
 * cards, all grey bars, no words. Two vets looked at it independently
 * and both said the same thing: "the page isn't loading." The bars
 * measured 1.33:1 in the light theme and 1.27:1 in the dark against the
 * card they sat on, where WCAG asks 3:1 of any graphic that carries
 * meaning -- so they were either meaningful and failing, or decoration
 * filling most of the screen. One of the vets added the thing none of
 * us could see from inside: the real panel's charts and invoice boxes
 * were not in that outline at all, so it was not even a preview of the
 * panel.
 *
 * The second said names, a weekday and a time under the title of the
 * "upcoming appointments" card, and the owner said of it what that vet
 * had said: the panel will not look like that. The wording was only the
 * first of three faults. The screen was teaching TWO first actions,
 * because the card asks for a VISIT and the sentence under it taught an
 * appointment. The note repeated what `readyFor` says two lines above.
 * And copying the real `CardTitle` made the preview the heaviest type
 * on a page whose whole job is to ask for one visit, so the example
 * outweighed the errand.
 *
 * So it stopped being a picture. A mock is a promise about how a screen
 * will look, and this product failed to keep that promise twice. What
 * is left is the thing a vet cannot see anywhere on their first evening
 * and has to be told: where writing one visit leads. That stays true
 * whatever the dashboard ends up looking like.
 *
 * EVERY LINK HAD TO BE SHOWN TO EXIST, and the first draft of this
 * block failed that test. It had five: visit, invoice, vaccination
 * date, reminder, appointment. Checked against the code, the middle one
 * was inert -- `followupAt` is written on the visit page and read
 * nowhere -- and the last two pointed the wrong way round. A reminder
 * does not grow out of a date in this product; it comes from an
 * appointment (`app/api/cron/reminders/route.ts`). An appointment is
 * opened from the animal's page, not from a reminder. Turning the order
 * the right way round left four, and all four are routes that exist
 * today (ux).
 *
 * IT IS A ROUTE, NOT A PROMISE, and that is carried by the words rather
 * than by the layout: "after the first visit, this is how it carries
 * on". An earlier wording said what the first visit STARTS, which
 * claims every visit produces all four. And the reminder line says "if
 * they have agreed", because the sweep only runs for clinics with
 * messaging switched on (`modules/notifications/service.ts`) and a new
 * clinic's consent is off by default. Two words are the difference
 * between describing the product and over-promising it.
 *
 * NOT A CHECKLIST, which is a different thing wearing the same shape. A
 * checklist asks the reader for four jobs; this asks for nothing. The
 * one thing the screen wants is still the card above it. So there are
 * no numbers, no boxes and no ticks -- and the arrow, not a bullet,
 * because an arrow is a direction and a bullet is an item.
 *
 * WHAT IT STILL MAY NOT SAY. No counter, no amount, no percentage, no
 * chart silhouette. The rule came from a vet who left a product after
 * seeing 11 on screen and 4 in the drawer -- "what made me leave was
 * not that the number was wrong, it was learning that a number COULD be
 * wrong".
 *
 * NOTHING HERE IS A RECORD, and it no longer has to be argued. The two
 * shapes before this one drew example rows, and the protection was that
 * they went nowhere: not links, not in any list, not answering a
 * search, nothing written to the database. This shape draws no example
 * at all -- no name, no date, no time -- so there is nothing to mistake
 * for a record in the first place. Twice a name we picked for an
 * example turned out to exist, once in a real clinic and once in our
 * own seed script; the whole class of mistake is gone rather than
 * guarded.
 *
 * NOTHING HERE MAY OUTWEIGH THE CARD ABOVE IT. The ceiling is
 * `text-sm font-medium`: no `text-lg`, no `font-semibold`. The screen's
 * focus is built by holding this block back, and the second shape lost
 * it by borrowing a real card's title.
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
 *
 * And no `Card` inside the frame, one level down from the same
 * argument: a `Card` brings its own `shadow-sm`, and a block whose
 * insides float exactly as the real cards do has inverted the one
 * signal saying it is not real.
 */

/**
 * The four links, in the order they happen in the clinic.
 *
 * Order is the content. A reader who takes these in any other sequence
 * learns something false about the product -- the draft that put the
 * reminder before the appointment had the causation backwards -- so the
 * order is carried by the arrows and by this array, and by nothing that
 * could drift from it.
 *
 * Not numbered, because numbers would make it a list of jobs. The
 * clinic is asked for one thing on this screen, and it is on the card
 * above.
 *
 * TWO THINGS TO KNOW BEFORE CHANGING THE WORDS.
 *
 * The last link rests on a fact outside this file. "If they have
 * agreed" is true today because the consent question is put to every
 * new owner as they are registered, so every owner a reminder could
 * reach has answered it. Make that question optional and this sentence
 * becomes a lie about a message the clinic thinks is going out (ux).
 *
 * And the four are one length class on purpose: subject plus passive
 * verb. The test of that is not character count -- what a reader sees
 * is WRAPPING, so on a narrow screen the four should wrap together or
 * not at all. A line that wraps on its own swells the block and breaks
 * the sense of a sequence, which is the only thing the block is for.
 * Measured at 390px on `dcf8809`: Turkish wraps the fourth line alone
 * and English wraps all four, so Turkish sits exactly on that limit
 * and was accepted. Shorten the words before crossing it (ui).
 */
const CHAIN = ["visit", "invoice", "appointment", "reminder"] as const;

export async function PreviewPanel() {
  const t = await getTranslations("dashboard");

  return (
    <div
      className={cn(
        surface,
        "flex flex-col gap-4 border-dashed p-6 shadow-none",
      )}
    >
      {/* Read, unlike the chain below it. Describing a shape to somebody
          who cannot see it is noise; telling them what this region is
          costs one sentence and there is no reason to withhold it.

          It also carries the whole explanation, which is why the mock's
          separate "example clinic" badge is not here: saying one fact
          in two places weakens both, and this sentence already does the
          badge's job and the caption's. */}
      <p className="text-sm text-muted-foreground">{t("previewNote")}</p>

      <ul
        // Not reachable, not selectable, not focusable, not announced:
        // nothing here is an action, and a tab stop on a picture is a
        // promise that something will happen.
        //
        // Still hidden now that the lines are sentences rather than
        // rows: the paragraph above says where the first visit leads,
        // and four fragments plus three arrows is the same fact again
        // in a form that reads aloud as a jumble.
        className="pointer-events-none select-none flex flex-col gap-1"
        aria-hidden="true"
      >
        {CHAIN.map((step, i) => (
          <li key={step} className="text-sm text-muted-foreground">
            {/* An element rather than `before:content`, because the
                arrows are the only thing carrying the order and a thing
                that carries meaning should be readable by whoever reads
                the markup -- a test included. On its own line and at
                the terms' left edge, so the eye runs down one column.

                Not an icon and not a drawn rule: an `svg` is barred
                here, and a rule needs a height and a fill on one
                element, which is barred too. Both guards exist because
                a silhouette of a chart is a claim about data. */}
            {i > 0 && (
              <span className="block text-xs text-muted-foreground">↓</span>
            )}
            {/* Subject and predicate of one sentence, so there is no
                separator between them: "Vizit hayvanın geçmişine
                işlenir" breaks if a dot or a colon is put in the middle,
                and in Turkish it breaks the agreement as well (ux). The
                weight marks which word is the term without cutting the
                sentence in two. */}
            <span className="font-medium text-foreground">
              {t(`previewChain.${step}.term` as never)}
            </span>{" "}
            {t(`previewChain.${step}.result` as never)}
          </li>
        ))}
      </ul>
    </div>
  );
}
