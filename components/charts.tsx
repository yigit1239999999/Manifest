// Lightweight, dependency-free charts rendered as inline SVG.
// They follow the active CSS variables so they re-skin with the theme.

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional tooltip / value display override. */
  display?: string;
}

/** How a datum reads aloud: "3 Mart: 14 vizit". */
function describe(d: BarDatum, formatValue?: (value: number) => string) {
  return `${d.label}: ${d.display ?? formatValue?.(d.value) ?? d.value}`;
}

/**
 * The last bucket of a rolling window is the period we are currently in, so
 * it is always lower than the ones beside it. Drawn plainly, the dashboard
 * reports a fall every Monday that never happened.
 *
 * Marked with a stripe pattern rather than a paler fill. A paler fill cannot
 * do both jobs at once, and the numbers say so: at `primary/40` the bar is
 * 1.79:1 against the card in light and 2.30:1 in dark, under the 3:1 bar for
 * a meaningful graphic — the bar marks itself by becoming hard to see. Raise
 * it until it clears 3:1 (about 72%) and it is 1.2:1 against the full bars,
 * so it no longer reads as different. A dashed top edge fails the same way
 * for a third reason: it would sit on its own fill, at 1.2:1.
 *
 * Stripes have no such trade-off. They are card-coloured over the normal
 * fill, so they inherit that fill's 3.57:1 (light) and 5.31:1 (dark), and
 * pattern is a channel that survives colour blindness and greyscale.
 */
const PARTIAL_STRIPES =
  "repeating-linear-gradient(45deg, transparent 0 4px, var(--color-card) 4px 6px)";

export function HorizontalBars({
  data,
  emptyLabel,
  className,
}: {
  data: BarDatum[];
  /**
   * Required, with no fallback. It used to default to "-", which is not a
   * sentence, does not say what is missing, and reads as a broken value
   * rather than an empty one (TEAM.md #21). Making it required is also what
   * stops the next chart from shipping without an empty state at all.
   */
  emptyLabel: string;
  className?: string;
}) {
  if (data.length === 0) {
    return <EmptyState size="inline" title={emptyLabel} />;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <li key={d.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
              {d.label}
            </span>
            <span className="relative flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-end text-xs font-semibold tabular-nums text-foreground">
              {d.display ?? d.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ColumnBars({
  data,
  height = 96,
  className,
  emptyLabel,
  formatValue,
  partialLast,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
  /**
   * Shown instead of the chart when there is nothing to plot.
   *
   * Required. It was optional and the revenue chart simply never passed it,
   * so a clinic with no paid invoices got a card with a title and nothing
   * at all underneath — indistinguishable from still loading or broken.
   * A missing empty state is now a build error rather than a blank box.
   */
  emptyLabel: string;
  formatValue?: (value: number) => string;
  /**
   * Marks the final bucket as a period still running. Both texts are
   * required together because the visual mark alone leaves a screen reader
   * user with the same false fall the chart used to show everyone.
   */
  partialLast?: { note: string; inProgress: string };
}) {
  // Two different kinds of "nothing", and the second is the one that actually
  // happens: the dashboard series are gap-filled to a fixed 12 weeks / 6
  // months, so `data` is never empty — a brand new clinic arrives here as
  // twelve buckets of zero. Treating only the first case as empty is why a
  // new clinic saw twelve stubby bars instead of an empty state.
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (data.length === 0 || total === 0) {
    return <EmptyState size="inline" title={emptyLabel} />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const lastIndex = data.length - 1;
  const summary = data
    .map((d, i) => {
      const text = describe(d, formatValue);
      return partialLast && i === lastIndex
        ? `${text} (${partialLast.inProgress})`
        : text;
    })
    .join(", ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* One image with one description. The bars themselves are decorative
          divs; without this the whole chart is silent to a screen reader. */}
      <div
        role="img"
        aria-label={summary}
        className="flex items-end gap-1 border-b border-border"
        style={{ height }}
      >
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const partial = Boolean(partialLast) && i === lastIndex;
          return (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 items-end"
              title={
                partial
                  ? `${describe(d, formatValue)} (${partialLast!.inProgress})`
                  : describe(d, formatValue)
              }
            >
              {/* A zero bucket draws nothing at all. The old floor of 2% drew
                  every zero as a stub, which made "no one came in" and "one
                  animal came in" the same height on a busy clinic's chart.
                  Non-zero values instead get a small pixel floor, so a value
                  that rounds to nearly nothing still reads as present. */}
              {d.value > 0 && (
                <div
                  className="w-full rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{
                    height: `${pct}%`,
                    minHeight: 2,
                    backgroundImage: partial ? PARTIAL_STRIPES : undefined,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center">
            {d.label}
          </span>
        ))}
      </div>
      {partialLast && (
        // Not `aria-hidden`: the same fact is in the chart's own summary, but
        // this line is also the only explanation a sighted user gets for the
        // stripes.
        <p className="text-[10px] text-muted-foreground">{partialLast.note}</p>
      )}
    </div>
  );
}
