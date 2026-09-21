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

  const titles = [
    t("upcomingAppointments"),
    t("recentVisits"),
    t("upcomingVaccinations"),
    t("petsBySpecies"),
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
            className={cn(surface, "h-24 border-dashed shadow-none")}
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
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
