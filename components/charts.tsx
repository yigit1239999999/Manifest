// Lightweight, dependency-free charts rendered as inline SVG.
// They follow the active CSS variables so they re-skin with the theme.

import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional tooltip / value display override. */
  display?: string;
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
      <p className="text-sm text-muted-foreground">{emptyLabel ?? "—"}</p>
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
            <span className="w-10 shrink-0 text-right text-xs font-semibold text-foreground">
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
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const tooltip = `${d.label}: ${d.display ?? formatValue?.(d.value) ?? d.value}`;
          return (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 items-end"
              title={tooltip}
            >
              <div
                className="w-full rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
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
