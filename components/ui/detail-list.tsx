import * as React from "react";
import { cn } from "@/lib/utils";

// The backbone of every detail page: a label above or beside a value,
// repeated. It existed four times under two names — `Detail` on
// `/clients/[id]` and `/pets/[id]`, `Row` on `/appointments/[id]` and
// `/visits/[id]` — so the same layout carried two names and two layouts
// carried one name, which is how the fifth copy gets written without anyone
// noticing there were four.
//
// Two things this fixes beyond the duplication:
//
//   - the pairs were loose `<span>`s in a `<div>`. A screen reader read
//     fourteen unrelated fragments; as a `<dl>` it reads a label and its
//     value as the pair they are (TEAM.md #26).
//   - the empty value was decided at the call site, three different ways:
//     `value || "-"` inside one copy, `?? "-"` at the caller in another,
//     nothing at all in the other two. A field with no value now always
//     shows the same mark, and the row stays: an empty field says "nobody
//     filled this in", a missing row says "there is no such field", and
//     those are different facts (TEAM.md #21).
//
// `items` rather than children because these pages render on the server,
// where a layout shared through context is not available — and passing the
// layout to every item by hand is exactly the drift this replaces.

export type DetailItem = {
  /** Already translated. The component owns no strings. */
  label: string;
  /**
   * `null` and `undefined` both mean "not filled in" and render the same
   * mark. An empty string does too: a blank value in the database and a
   * missing one look identical to the reader, and they are.
   */
  value: React.ReactNode;
};

/** What a field with no value shows. One character, decided in one place. */
const EMPTY = "-";

function isEmpty(value: React.ReactNode): boolean {
  return value == null || value === "" || value === false;
}

export function DetailList({
  items,
  layout = "stack",
  columns = 1,
  className,
}: {
  items: readonly DetailItem[];
  /**
   * `stack` puts the label above the value and is the default: a value of
   * any length gets the full width, which addresses and owner names need.
   * `inline` puts them on one line, label start, value end, for a column of
   * short readings — the vitals on `/visits/[id]` are the case it exists
   * for, and a stacked pair per reading there doubles the card's height.
   */
  layout?: "stack" | "inline";
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "text-sm",
        columns === 1 && "flex flex-col gap-2",
        columns === 2 && "grid gap-2 sm:grid-cols-2",
        columns === 3 && "grid gap-2 sm:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={
            layout === "inline"
              ? "flex items-center justify-between gap-3"
              : "flex flex-col gap-0.5"
          }
        >
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="text-sm text-foreground">
            {isEmpty(item.value) ? EMPTY : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
