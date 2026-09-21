// Suspense fallbacks used by loading.tsx routes.

import type { ReactNode } from "react";
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
 * What it drew was a guess at that form: four or six identical boxes in one
 * grid and a button under them. pm measured what the guess cost -- skeleton
 * 326-396px against a settled form of 646-1060px -- and the number is not
 * the finding. The finding is where the button was: the thumb is already on
 * its way to a control that is about to be three hundred pixels further
 * down, and the eye has to start the page over.
 *
 * So the rule these pieces exist to keep is web.dev's own, and it is the
 * only one: RESERVE THE SAME BOX, OR DRAW NOTHING THERE. A skeleton is a
 * promise about where things will be, and there is no partial credit for a
 * promise that is nearly kept. A route whose height depends on data nobody
 * has loaded yet -- how many species a clinic has enabled, whether a fold
 * opens on arrival -- gets the part that IS determinate and stops, rather
 * than a button placed by arithmetic that is only sometimes right.
 *
 * Every piece below is measured against the real control, not against the
 * look of it: `Input`, `Select`, `Combobox` and `DateTimeInput` are all
 * `h-10`, a `Label` is a `text-sm` line, `Field` stacks them at `gap-1.5`.
 * The skeleton it replaced used `h-9` and `h-2.5`, which is four pixels and
 * ten pixels of quiet debt per field.
 */
export function FormSkeleton({
  wide = false,
  description = false,
  children,
}: {
  wide?: boolean;
  /** The routes whose `PageHeader` carries a subtitle under the title. */
  description?: boolean;
  children: ReactNode;
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
          card jump down as the form arrives. Both are text lines, so they
          are reserved at their line box -- 20px and 32px -- rather than at
          the height a bar happens to look right at. */}
      <Skeleton className="h-5 w-16" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        {description && <Skeleton className="h-5 w-64 max-w-full" />}
      </div>
      <Card className="p-6">
        {/* `ActionForm` caps a narrow form at `max-w-form`, so the
            skeleton does too: otherwise the fields are the full width of
            the card here and narrower a moment later. */}
        <div className={cn(!wide && "max-w-form")}>{children}</div>
      </Card>
    </div>
  );
}

/**
 * One `Field`: its label line, its control, and the hint when the real
 * field has one.
 *
 * `rows` draws a `Textarea` instead of a box control, at the height the
 * rows actually produce -- 20px a line, 16px of padding, 2px of border --
 * because a four-row SOAP box and a one-line input differ by sixty pixels
 * and there are four of them on `/visits/new`.
 */
export function FieldSkeleton({
  hint = false,
  rows,
}: {
  hint?: boolean;
  rows?: 2 | 3 | 4;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className={cn("w-full", rows ? TEXTAREA_HEIGHT[rows] : "h-10")} />
      {hint && <Skeleton className="h-4 w-40 max-w-full" />}
    </div>
  );
}

// 18px of chrome (`py-2` and the border) plus a 20px line per row.
const TEXTAREA_HEIGHT = {
  2: "h-[3.625rem]",
  3: "h-[4.875rem]",
  4: "h-[6.125rem]",
} as const;

/** A `FormSection`: its heading block, its rule, and its fields. */
export function FormSectionSkeleton({
  description = false,
  children,
}: {
  description?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <Skeleton className="h-5 w-32" />
        {description && <Skeleton className="h-4 w-56 max-w-full" />}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * A `fieldset` block -- SOAP, vitals -- with its legend sitting in the
 * border the way the real one does.
 */
export function FieldsetSkeleton({
  cols,
  children,
}: {
  cols: 2 | 4;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={cn(
        surface,
        "grid gap-4 p-4",
        cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-4",
      )}
    >
      <legend className="px-2">
        <Skeleton className="h-5 w-24" />
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * The closed fold (`OptionalDetails`).
 *
 * Closed is the only state a skeleton may draw: open is decided by whether
 * the record being edited has any of those fields filled, which is the
 * answer the page is still waiting for. Drawing it closed is right for
 * every new record and for every edit of a record that has nothing behind
 * the fold; the routes where it can be wrong stop above it instead.
 */
export function FoldSkeleton() {
  return (
    <div className="rounded-surface border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-col">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-0.5 h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="size-4 shrink-0" />
      </div>
    </div>
  );
}

/**
 * The three-way consent question (`ConsentChoice`).
 *
 * One row of 28px targets rather than three boxes: the answers sit side
 * by side until the line runs out, and they are taller than their text
 * because WCAG 2.5.8 asks for 24px and a `text-sm` line gives 20.
 */
export function ConsentSkeleton() {
  return (
    <fieldset className="min-w-0">
      <Skeleton className="mb-2 h-5 w-44" />
      <Skeleton className="h-7 w-72 max-w-full" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
    </fieldset>
  );
}

/**
 * The submit button, where it is going to be.
 *
 * `hint` is the "required fields: ..." line two of these forms put beside
 * the button; the row is the same `h-10` either way, so it changes what is
 * drawn and not where anything lands.
 */
export function SubmitSkeleton({ hint = false }: { hint?: boolean }) {
  return hint ? (
    <div className="flex items-center justify-end gap-3">
      <Skeleton className="h-4 w-48 max-w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  ) : (
    <Skeleton className="h-10 w-32" />
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
 * not know whether that card will render. Reserving the 166px would pay
 * for the clinics that see the card with an equal jump, upward, on every
 * dashboard of every clinic that is past first run -- the opposite trade,
 * and much the larger one, though not as lopsided as it first looked: the
 * card stays until the chain is complete, so a clinic that signs up and
 * adds its first client a week later meets this on every dashboard for a
 * week, not once.
 *
 * It is a jump the vet really takes, which was worth checking before
 * settling for it: on an empty clinic the insight queries run against
 * empty tables, and the skeleton could have been drawn too briefly to
 * register. Sampled every 8ms across a real soft navigation, five runs
 * out of five painted it, for 376ms to 514ms -- several times over the
 * ~100ms where a change stops being noticed.
 *
 * Moving the card below the preview is the other way to reach zero, and
 * it would work: the grids would hold the skeleton's y, and the card
 * would arrive underneath as new content with nothing displaced. It is
 * refused on the design rather than on the cost. The card is the only
 * thing on that screen anyone can act on, and putting it under ten grey
 * placeholders walks the vet through a mock-up to reach it. The whole
 * first-run layout is one foreground against one background -- the card
 * at full contrast with a shadow, the preview pulled back -- and sending
 * the card down inverts that. Half a second of movement is cheaper than
 * the reading order of the first screen a clinic ever sees.
 *
 * None of this breaks the condition it sounds like it breaks. That
 * condition is about *what* moves, not how far: nothing the reader can
 * aim at changes place, and no text slides upward while it is being read.
 * The skeleton holds no target, and the card's button does not move into
 * position -- it appears where there was nothing before.
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
