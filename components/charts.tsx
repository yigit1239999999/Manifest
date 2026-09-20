// Lightweight, dependency-free charts rendered as inline SVG.
// They follow the active CSS variables so they re-skin with the theme.

import { cn } from "@/lib/utils";

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

export function HorizontalBars({
  data,
  emptyLabel,
  className,
}: {
  data: BarDatum[];
  emptyLabel?: string;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyLabel ?? "-"}</p>
    );
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
            <span className="w-10 shrink-0 text-end text-xs font-semibold text-foreground">
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
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
  /** Shown instead of the chart when there is nothing to plot. */
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}) {
  // Two different kinds of "nothing", and the second is the one that actually
  // happens: the dashboard series are gap-filled to a fixed 12 weeks / 6
  // months, so `data` is never empty — a brand new clinic arrives here as
  // twelve buckets of zero. Treating only the first case as empty is why a
  // new clinic saw twelve stubby bars instead of an empty state.
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (data.length === 0 || total === 0) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const summary = data.map((d) => describe(d, formatValue)).join(", ");

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
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 items-end"
              title={describe(d, formatValue)}
            >
              {/* A zero bucket draws nothing at all. The old floor of 2% drew
                  every zero as a stub, which made "no one came in" and "one
                  animal came in" the same height on a busy clinic's chart.
                  Non-zero values instead get a small pixel floor, so a value
                  that rounds to nearly nothing still reads as present. */}
              {d.value > 0 && (
                <div
                  className="w-full rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{ height: `${pct}%`, minHeight: 2 }}
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
    </div>
  );
}
