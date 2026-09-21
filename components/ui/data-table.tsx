import * as React from "react";
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
//     `overflow-x-auto` keeps the corners and lets the table scroll.
//   - money columns were right-aligned with `text-right`, a physical
//     direction (TEAM.md #31). `align: "end"` emits `text-end`.
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
   */
  hideBelow?: "sm" | "md";
  align?: "start" | "end";
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
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
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
                  column.align === "end" ? "text-end" : "text-start",
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
                    column.align === "end" && "text-end",
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
