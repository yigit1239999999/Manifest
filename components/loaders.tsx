// Suspense fallbacks used by loading.tsx routes.

import { Skeleton } from "@/components/ui/skeleton";
import { Card, surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The shape of a list route while it loads.
 *
 * `action` and `filter` exist because a skeleton that shows a search box and
 * a "New" button on a route that has neither is not a hint, it is a wrong
 * answer — the page then settles into a different layout and the eye has to
 * start over. `/audit` and `/prescriptions` have neither; `/staff` has the
 * button but no filter. Both default to what every earlier caller has, so
 * this stays a two-word change at the call sites that differ.
 */
export function ListSkeleton({
  rows = 6,
  action = true,
  filter = true,
}: {
  rows?: number;
  action?: boolean;
  filter?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-40" />
        {action && <Skeleton className="h-9 w-28" />}
      </div>
      {filter && <Skeleton className="h-10 w-full max-w-sm" />}
      <div className={cn("overflow-hidden", surface)}>
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="size-9 shrink-0 rounded-pill" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One card-shaped block: a title, an optional description line, and `lines`
 * rows of content. `/settings` and `/reminders` are built from these rather
 * than from a table, so the list skeleton would settle into the wrong shape.
 */
export function CardSkeleton({
  lines = 3,
  description = true,
}: {
  lines?: number;
  description?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        {description && <Skeleton className="h-3 w-64 max-w-full" />}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}

/**
 * The shape of a form route while it loads.
 *
 * Eleven list and detail routes had a `loading.tsx`; none of the eleven form
 * routes did, although the form routes are the ones that fetch a clinic's
 * clients and animals before they can draw a picker. On a slow link the walk
 * a new clinic makes -- `/visits/new` to `/pets/new` to `/clients/new` --
 * was a blank screen at every step, on the three screens where the vet is
 * least sure what is supposed to happen next.
 *
 * `fields` and `wide` are here for the reason `ListSkeleton` takes `action`
 * and `filter`: a skeleton that settles into a different layout is not a
 * hint but a wrong answer, and the eye starts over. Visits and invoices are
 * the wide pair (`max-w-4xl`); the field count is the number of controls
 * above the fold, not the whole form, because the fold is all the skeleton
 * is ever on screen for.
 */
export function FormSkeleton({
  fields = 4,
  wide = false,
}: {
  fields?: number;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6",
        wide ? "max-w-4xl" : "max-w-3xl",
      )}
    >
      {/* `BackLink`, then the title: both are drawn by the page itself and
          are the first things to settle, so leaving them out would make the
          card jump down as the form arrives. */}
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-7 w-48" />
      <Card className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </Card>
    </div>
  );
}

/** The title and subtitle every route opens with (`PageHeader`). */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-28" />}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <Skeleton className="mb-4 h-4 w-20" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </Card>
          <Card className="p-6">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * The dashboard's waiting shape: seven counter tiles and four list cards,
 * written to the same grids the real panel uses.
 *
 * The grids line up and the header block does not, and the second half is
 * deliberate. Measured on `cb827ed`: the tiles land at the same x and the
 * same 235x96 as the loaded page, but the whole block sits 166px higher
 * here, because a first-run dashboard carries a greeting, a `FirstStepCard`
 * and a centred line above the panel while this file carries two rules.
 *
 * It cannot carry more. `loading.tsx` is drawn before any data, so it does
 * not know whether that card will render. Reserving the 166px would buy one
 * clinic's first load at the price of an equal jump, upward, on every
 * dashboard of every clinic that is past first run -- the opposite trade.
 * The shift that remains is downward onto a skeleton nothing can be aimed
 * at, so it costs a glance rather than a mis-tap.
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-surface" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-6">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-control" />
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
