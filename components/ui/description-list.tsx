import * as React from "react";
import { cn } from "@/lib/utils";

// The backbone of every detail page: a label above or beside a value,
// repeated. It existed five times under three names — `Detail` on
// `/clients/[id]` and `/pets/[id]`, `Row` on `/appointments/[id]` and
// `/visits/[id]`, `SoapBlock` for the visit notes — so the same layout
// carried two names and two layouts carried one name, which is how the
// sixth copy gets written without anyone noticing there were five.
//
// Three things this fixes beyond the duplication:
//
//   - the pairs were loose `<span>`s in a `<div>`. A screen reader read
//     fourteen unrelated fragments; as a `<dl>` it reads a label and its
//     value as the pair they are (TEAM.md #26).
//   - the empty value was decided at the call site, four different ways:
//     `value || "-"` inside two copies, `?? "-"` at the caller in another,
//     nothing at all in the rest. A field with no value now always shows
//     the same mark, and the row stays: an empty field says "nobody filled
//     this in", a missing row says "there is no such field", and those are
//     different facts (TEAM.md #21).
//   - the vitals were a column of figures in proportional digits, so the
//     readings did not line up with each other. `numeric` is the same
//     decision `DataTable` makes for a money column.
//
// `items` rather than children because these pages render on the server,
// where a layout shared through context is not available — and passing the
// layout to every item by hand is exactly the drift this replaces.

export type DescriptionItem = {
  /** Already translated. The component owns no strings. */
  label: string;
  /**
   * `null`, `undefined` and `""` all mean "not filled in" and render the
   * same mark. A blank value in the database and a missing one look
   * identical to the reader, and they are.
   */
  value: React.ReactNode;
  /**
   * A figure: a measurement, a count, an amount. Sets `tabular-nums`, and
   * in `row` layout aligns to the end, so a column of readings can be
   * compared down its length rather than re-read line by line.
   */
  numeric?: boolean;
  /**
   * Free text the clinician typed, with their line breaks kept. The SOAP
   * notes on `/visits/[id]` are what this exists for; four call sites, and
   * without it the value collapses to one paragraph.
   */
  multiline?: boolean;
};

/**
 * What a field with no value shows. One character, decided in one place.
 * A hyphen, not an en or em dash: these sit in narrow columns where the
 * longer marks wrap badly.
 */
const EMPTY = "-";

function isEmpty(value: React.ReactNode): boolean {
  return value == null || value === "" || value === false;
}

/**
 * Deliberately absent, each for a reason (TEAM.md #30):
 *   - no `href`: a value that is a link is a value the caller builds.
 *   - no `icon`: fourteen pairs on a page, fourteen icons is noise.
 *   - no `columns`: the grid belongs to the card, which already knows how
 *     wide it is. It arrives through `className`.
 */
export function DescriptionList({
  items,
  layout = "stacked",
  className,
}: {
  items: readonly DescriptionItem[];
  /**
   * `stacked` puts the label above the value and is the default: a value
   * of any length gets the full width, which addresses, owner names and
   * free text need.
   *
   * `row` puts them on one line, label at the start and value at the end.
   * Use it only in a narrow single-column card holding short scalar
   * values — the vitals on `/visits/[id]` are the case it exists for,
   * where seven stacked pairs would be fourteen lines instead of seven.
   * Anywhere a value can wrap, `stacked` is the right one.
   *
   * There is a lower bound on the container (see the row class below) and
   * deliberately no upper one, which is only safe as far as today's call
   * sites go: every container `row` renders in is between 176px and about
   * 432px. Put it in a wide one and the label sits hundreds of pixels from
   * its value, which no eye pairs up — the reason `/visits/[id]` keeps its
   * three-column grid rather than letting the card go full width.
   */
  layout?: "stacked" | "row";
  className?: string;
}) {
  const row = layout === "row";

  return (
    // The container the pairs measure themselves against is this list, not
    // the viewport. See the note on the row class below.
    <dl className={cn("flex flex-col gap-2 text-sm", row && "@container", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={
            row
              ? // The width that decides this is the list's, not the
                // screen's, and on this page the two move in opposite
                // directions. `/visits/[id]` puts the vitals card in a
                // `lg:grid-cols-3`, so the card is at its narrowest exactly
                // when the window is at its widest. Measured, container
                // width after the card's own padding:
                //
                //   390px  phone, single column   310px
                //   1024px three columns, capped  176px
                //   1280px three columns          261px
                //   1440px three columns, capped  298px
                //
                // The widest pair needs ~232px: the longest label is
                // English, "Respiration (bpm)" at 17 characters, ~136px at
                // 12px uppercase with `tracking-wide`, plus the gap and a
                // formatted date. Turkish is shorter here — "Solunum
                // (bpm)" is 13 — which is the second time on this surface
                // that the instinct about which language is longer was
                // wrong (TEAM.md #32b).
                //
                // `@2xs` (288px) rather than a screen breakpoint, which
                // cannot see any of this, and rather than `flex-wrap`,
                // which would wrap the three long pairs and leave the four
                // short ones on one line — breaking the figure column at
                // points that move with the language, which is the one
                // thing `numeric` exists to prevent.
                "flex flex-col gap-0.5 @2xs:flex-row @2xs:items-baseline @2xs:justify-between @2xs:gap-4"
              : "flex flex-col gap-0.5"
          }
        >
          {/* `items-baseline`, not `items-center`: the label is 12px and the
              value 14px, so centring them leaves the text sitting on two
              different lines to the eye. */}
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={cn(
              "text-sm text-foreground",
              item.numeric && "tabular-nums",
              item.numeric && row && "@2xs:text-end",
              // Muted, so that the absence of a value does not read as a
              // value someone entered.
              isEmpty(item.value) && "text-muted-foreground",
            )}
          >
            {isEmpty(item.value) ? (
              EMPTY
            ) : item.multiline ? (
              <p className="whitespace-pre-wrap">{item.value}</p>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
