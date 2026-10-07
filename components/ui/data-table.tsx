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
// Too wide for its container, a table can either scroll or stack. Scrolling
// was the only answer for a while, and pm measured what it costs at 390px:
// the invoice list was 485px inside 292, so the vet saw the number, the
// client and the date, and had to guess at a sideways swipe — nothing on
// screen hinted at one — to learn what was owed and whether it was paid.
// The columns that fell off were the ones the list exists for. `narrow=
// "stack"` is the other answer; see the prop.
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
  /**
   * Where the cell goes when the table is stacked (`narrow="stack"` and
   * too little room). Ignored otherwise.
   *
   *   - `title`:    first line, start. The row's name.
   *   - `end`:      first line, end, never shrinks. What the row is *for*.
   *   - `meta`:     second line, start, side by side.
   *   - `meta-end`: second line, end, never shrinks. Always last.
   *
   * One `end` per row, and one `meta-end`. Each is pushed to its line's
   * end by an auto margin, which follows it onto the next line if it
   * wraps; two of them would come apart at a wrap with the first one
   * stranded mid-row. So a list with an amount *and* a status puts the
   * amount at `end` (where it lines up down the list, which it would not
   * beside a status badge whose width changes with every row) and the
   * status at `meta-end`, the corner the eye checks next.
   *
   * Defaults: the first column is the title, a `numeric` column is `end`
   * (an amount pushed onto a second line is an amount read second), and
   * everything else is `meta`. A status column has to say where it goes:
   * nothing in a column's shape says it is the status.
   */
  stack?: "title" | "end" | "meta" | "meta-end";
};

/**
 * Below 32rem (512px) of its own container a `narrow="stack"` table stops
 * being a table. 512 because the widest stacking list, `/invoices`, needs
 * 485px as columns; under that, one of its columns is off-screen.
 *
 * A container query and not a screen breakpoint, for the reason
 * `hideBelow` documents: the sidebar grows at `md`, so at 768px the table
 * has 464px, *less* than the 544px it had at 640. A screen breakpoint
 * would turn the cards back into a table at exactly the width where the
 * table stops fitting again.
 */
const S = {
  table: "@max-lg:block",
  // Off the screen, still in the tree: with the visible headers gone, it
  // is what a screen reader names each cell by.
  thead: "@max-lg:sr-only",
  tbody: "@max-lg:block",
  // Two lines: title and `end`, then the meta cells. The `::after` is the
  // line break (a zero-height, full-width flex item ordered between the
  // two groups) because nothing but a cell may sit inside a row.
  row: "@max-lg:flex @max-lg:flex-wrap @max-lg:items-baseline @max-lg:gap-x-3 @max-lg:gap-y-0.5 @max-lg:px-4 @max-lg:py-3 @max-lg:after:order-1 @max-lg:after:basis-full @max-lg:after:content-['']",
  // The cells are flex items now, which blockifies them on its own.
  // `display` is left alone so that `hideBelow`'s `hidden` still hides.
  cell: "@max-lg:p-0",
  // `min-w-0` without `flex-1`: a title that can shrink to nothing gets
  // broken mid-token ("#INV-2026-" over "57336") to make room for the
  // `end` cell. Left at its own width, it is the `end` cell that moves
  // down a line instead, and its auto margin keeps it at the end there.
  title: "@max-lg:min-w-0",
  end: "@max-lg:ms-auto @max-lg:shrink-0",
  meta: "@max-lg:order-2",
  "meta-end": "@max-lg:order-3 @max-lg:ms-auto @max-lg:shrink-0",
} as const;

function stackSlot<Row>(column: Column<Row>, index: number) {
  return (
    column.stack ?? (index === 0 ? "title" : column.numeric ? "end" : "meta")
  );
}

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
  narrow = "scroll",
}: {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly Column<Row>[];
  /**
   * Names the table for screen readers when the page's heading does not.
   * Visually hidden; a table with no name is announced as "table".
   */
  caption?: string;
  /**
   * What happens when the columns do not fit.
   *
   * `scroll`, the default, keeps the table and lets it scroll sideways.
   * Right for a list that already fits a phone by dropping columns with
   * `hideBelow` (`/appointments`, `/staff`).
   *
   * `stack` turns each row into a two-line card below 512px of container:
   * the title and its `end` cell on the first line, the rest under it.
   * Nothing is dropped and nothing is off-screen. See `stack` on `Column`.
   */
  narrow?: "scroll" | "stack";
}) {
  const stacks = narrow === "stack";

  return (
    // `min-w-0` is not decoration: this sits in a `flex flex-col` page
    // container, and a flex item whose content cannot shrink refuses to be
    // narrower than that content — so the scroll container grows instead of
    // scrolling, and the whole page scrolls sideways with it. It showed up
    // on `/staff` first because that is the only list with five columns and
    // an unbreakable e-mail address in one of them, but the defect belongs
    // here and would have found the next list eventually (TEAM.md #4, #27).
    //
    // `@container` is what a stacking table measures; see `S`.
    <div className={cn("@container min-w-0 overflow-x-auto", surface)}>
      <table className={cn("w-full text-sm", stacks && S.table)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead
          className={cn(
            "bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground",
            stacks && S.thead,
          )}
        >
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
        <tbody className={cn("divide-y divide-border", stacks && S.tbody)}>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn("hover:bg-muted/30", stacks && S.row)}
            >
              {columns.map((column, index) => (
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
                    stacks && S.cell,
                    stacks && S[stackSlot(column, index)],
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
