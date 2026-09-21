import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";

/**
 * What this dashboard will look like once the clinic has records in it.
 *
 * A clinic on its first morning otherwise reads a grid of zeroes and a
 * column of "nothing yet" sentences — a page that works perfectly and
 * says only that you have done nothing. This shows the shape instead,
 * and the shape is the reassurance: the panel is real, it is simply
 * waiting.
 *
 * NOT `Skeleton`, and the two reasons are why this is its own file
 * (ux). `animate-pulse` means "loading", and a screen that pulses
 * permanently says the opposite of calm at half past seven in the
 * evening. And `bg-muted` (#1f2521) on `bg-card` (#161c18) is very
 * nearly nothing in the dark theme: the bars would vanish and the
 * preview would read as a grid of empty boxes, which is worse than the
 * zeroes it replaced. The bars are `bg-border`, visible in both.
 *
 * The SHAPE is `DashboardSkeleton`'s, deliberately and to the box:
 * seven tiles and four cards. That is what closes the jump between
 * loading and loaded — and, here, between waiting and arriving.
 *
 * The section titles are real and readable. The information lives in
 * them; the bars are only form, which is why they are the part hidden
 * from a screen reader. What a reader is told instead is the one
 * sentence above this panel.
 *
 * NOTHING HERE MAY BE READ AS DATA, and that is three rules working
 * together rather than one (ux, from a vet who left a product after
 * seeing 11 on screen and 4 in the drawer -- "what made me leave was
 * not that the number was wrong, it was learning that a number COULD
 * be wrong"). No digits anywhere, placeholder or not. No chart
 * silhouettes -- six bars of differing heights under "revenue, last
 * six months" is a claim about revenue whether or not a figure sits
 * beneath them, which is exactly where an instinct to "make it look
 * more real" leads. And a dashed frame, because real data in this
 * product is never drawn in one.
 *
 * Any one of the three alone fails the screenshot test; the three
 * together pass it. This is also why the shape stays exactly the
 * skeleton's four list-shaped cards and is not "improved" into
 * something that resembles the real panel more closely.
 *
 * Held back with a dashed border and no shadow rather than with
 * opacity. In the dark theme card and page are already close (#161c18
 * against #0f1411) and opacity dissolves what little separation there
 * is; a dashed frame already means "nothing here yet" in this codebase
 * (`empty-state.tsx`). `surface` and not `Card`, because `Card` brings
 * the shadow this must not have: the one fully-present, shadowed thing
 * on the screen is the card asking for the first record.
 */
export async function PreviewPanel() {
  const t = await getTranslations("dashboard.sections");

  // The real panel's own reading order, checked against it rather than
  // chosen: appointments, visits, species, vaccinations last and full
  // width (`app/(app)/page.tsx`). That order is the point of the whole
  // panel -- the moment it exists for is a vet writing their first
  // visit, coming back, and finding their own animal in the place the
  // grey draft had held. That only happens if the places match.
  //
  // The two money-and-volume charts are DELIBERATELY ABSENT, and this
  // is the note for whoever thinks the preview looks incomplete. A
  // placeholder under "revenue, last six months" sets up an
  // expectation of an amount no matter what is drawn beneath it, and
  // the preview saying too little is safe where saying too much about
  // money is not. `visitsLast12Weeks` is out for the same reason.
  //
  // It costs something and we are paying it knowingly: the preview
  // describes the panel incompletely, missing its two largest cards.
  // The skeleton already makes that trade -- four list-shaped cards
  // for a panel that has charts -- and matching the skeleton exactly
  // is what buys the measurable thing, which is no layout jump. A
  // soft incompleteness is not worth a hard gain.
  const titles = [
    t("upcomingAppointments"),
    t("recentVisits"),
    t("petsBySpecies"),
    t("upcomingVaccinations"),
  ];

  return (
    <div
      // Not reachable, not selectable, not focusable: nothing here is
      // an action, and a tab stop on a picture of a dashboard is a
      // promise that something will happen.
      className="pointer-events-none select-none flex flex-col gap-8"
      aria-hidden="true"
    >
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              surface,
              "flex h-24 flex-col justify-between border-dashed p-4 shadow-none",
            )}
          >
            {/* Two bars where a label and a figure will be, and every
                tile gets the SAME two. A digit here would be a claim --
                even as a placeholder -- and identical bars cannot be
                read as one tile having more of something than another.
                Empty tiles were the other failure: a grid of blank
                boxes says less than the zeroes it replaced. */}
            <div className="h-2.5 w-20 rounded bg-border" />
            <div className="h-5 w-10 rounded bg-border" />
          </div>
        ))}
      </div>
      {/* `[&>*]:min-w-0`, matching the real grid rather than earning it
          here: a grid item's `min-width` is `auto`, so it refuses to be
          narrower than its own content, and that is what produced the
          140px overflow measured at 390px on the panel this one is a
          picture of.
          Nothing in here can overflow today -- every width is a
          percentage or a small constant -- so this buys nothing now. It
          is here because the contract is "the skeleton's shape
          exactly", and the day somebody puts real content in, the
          overflow would come back on the screen everyone assumes is
          safe. */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {titles.map((title) => (
          <div
            key={title}
            className={cn(
              surface,
              "flex flex-col gap-3 border-dashed p-6 shadow-none",
            )}
          >
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="size-8 shrink-0 rounded-control bg-border" />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="h-3 w-1/2 rounded bg-border" />
                  <div className="h-2.5 w-1/4 rounded bg-border" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
