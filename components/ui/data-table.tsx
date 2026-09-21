import * as React from "react";
import { surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The same table markup was copy-pasted into seven list routes, down to the
// class strings: the same rounded card, the same uppercase header row, the
// same `px-4 py-3` in every cell. Seven copies is also seven chances for the
// eighth to be slightly different, which is how a list stops looking like
// the list next to it (TEAM.md #18).
//
// Two things the copies got wrong and this fixes in one place:
//
//   - the wrapper was `overflow-hidden`, which is there for the rounded
//     corners but also silently *clips* a wide table on a narrow screen.
//     Six of the seven had no responsive handling at all, so on a phone the
//     last columns were cut off with no way to reach them (TEAM.md #27).
//     `overflow-x-auto` keeps the corners and lets the table scroll, with
//     `min-w-0` so that it is allowed to be narrower than its own content.
//   - money columns were right-aligned with `text-right`, a physical
//     direction (TEAM.md #31). `align: "end"` emits `text-end`. They also
//     had proportional figures, so the digits above the last one did not
//     line up at all; `numeric` now carries both halves of that decision.
//
// Deliberately not used by the invoice line items on `/invoices/[id]`. That
// table sits bare inside a card, with tighter padding and a `<tfoot>` of
// running totals. Bending this component to fit it would mean a `footer`
// prop and a "no card" variant for one call site each, and a shared
// component that has to be told to stop sharing is not one (TEAM.md #30).

export type Column<Row> = {
  /** Stable identity for the column; only used as a React key. */
  key: string;
  /** Already translated. The component owns no strings. */
  header: string;
  cell: (row: Row) => React.ReactNode;
  /**
   * Drop the column below this breakpoint.
   *
   * `/appointments` established the pattern the others lacked: on a phone
   * the secondary columns are hidden and what matters rides along inside
   * the first cell. Hiding a column is only honest when its content is
   * still reachable somewhere.
   *
   * Pick the threshold against the width of the *container*, not the
   * viewport. The sidebar goes from 64px to 240px at `md`, so the content
   * column is 462px wide at 768 and was 669px at 767 — the page gets
   * wider and the table gets 207px poorer at the same instant. A column
   * revealed at `md` is revealed exactly when the room for it disappears.
   */
  hideBelow?: "sm" | "md" | "lg";
  align?: "start" | "end";
  /**
   * A column of figures: money, counts, measurements.
   *
   * Implies `align: "end"` and adds `tabular-nums`, and the two travel
   * together on purpose. Right-aligning alone lines up the last digit but
   * not the ones before it — in the default proportional figures "1.234,56"
   * and "999,00" put their commas in different places, so the eye has to
   * re-find the decimal point on every row. A money column exists to be
   * compared down its length; that is the whole job.
   *
   * Kept separate from `align` rather than folded into it because two of
   * today's three `align: "end"` columns are a "Details →" link, not a
   * number. Alignment is the layout's decision, figures are the content's.
   */
  numeric?: boolean;
  /**
   * Keep the header in the accessibility tree but off the screen.
   *
   * For an actions column, where a visible heading would be noise but an
   * empty `<th>` leaves the cells below it with no column name at all.
   */
  headerHidden?: boolean;
  /** Extra classes for this column's body cells (not the header). */
  cellClassName?: string;
};

const hideClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

export function DataTable<Row>({
  rows,
  rowKey,
  columns,
  caption,
}: {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly Column<Row>[];
  /**
   * Names the table for screen readers when the page's heading does not.
   * Visually hidden; a table with no name is announced as "table".
   */
  caption?: string;
}) {
  return (
    // `min-w-0` is not decoration: this sits in a `flex flex-col` page
    // container, and a flex item whose content cannot shrink refuses to be
    // narrower than that content — so the scroll container grows instead of
    // scrolling, and the whole page scrolls sideways with it. It showed up
    // on `/staff` first because that is the only list with five columns and
    // an unbreakable e-mail address in one of them, but the defect belongs
    // here and would have found the next list eventually (TEAM.md #4, #27).
    <div className={cn("min-w-0 overflow-x-auto", surface)}>
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium",
                  column.align === "end" || column.numeric
                    ? "text-end"
                    : "text-start",
                  column.hideBelow && hideClass[column.hideBelow],
                )}
              >
                {column.headerHidden ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-muted/30">
              {columns.map((column) => (
                <td
                  key={column.key}
                  // `align-top` for every cell, not a prop: a row is as tall
                  // as its tallest cell, and a one-line cell floating in the
                  // middle of a three-line row reads as belonging to neither.
                  className={cn(
                    "px-4 py-3 align-top",
                    (column.align === "end" || column.numeric) && "text-end",
                    column.numeric && "tabular-nums",
                    column.hideBelow && hideClass[column.hideBelow],
                    column.cellClassName,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
