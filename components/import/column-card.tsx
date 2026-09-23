"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Callout } from "@/components/ui/callout";
import type { ColumnEvidence } from "@/modules/import/infer";
import type { ImportField, Proposal } from "@/modules/import/fields";
import { cn } from "@/lib/utils";

/**
 * One column of the vet's file, said back to them.
 *
 * Three things are on the card and all three are theirs: the heading they
 * typed, three values out of their own rows, and the field those values are
 * allowed to land in. Nothing here is cleaned up or reformatted -- a phone
 * written with spaces is shown with its spaces, because the screen's job is
 * to report what the file says (#16).
 *
 * The samples are REAL values, never the masked ones. Masking exists for the
 * text that would be sent to a model; a person looking at `Xxxx Xxxxx` under
 * a heading that says "Adı" cannot tell an animal from its owner, which is
 * the one question this card exists to ask.
 */
export function ColumnCard({
  index,
  heading,
  evidence,
  proposal,
  value,
  onChange,
  dateOrder,
  onDateOrder,
  showUnanswered,
}: {
  index: number;
  /** What the vet typed above the column, if the first row is names. */
  heading?: string;
  evidence: ColumnEvidence;
  proposal: Proposal;
  /** `""` while an unsettled column has no answer: a choice nobody made. */
  value: ImportField | "";
  onChange: (field: ImportField | "") => void;
  /** The answer to "day first or month first", once given. */
  dateOrder?: "dayFirst" | "monthFirst";
  onDateOrder: (order: "dayFirst" | "monthFirst") => void;
  /** True once the vet has tried to move on, so questions can say they are open. */
  showUnanswered: boolean;
}) {
  const t = useTranslations("import");
  const selectId = `import-column-${index}`;
  const dateName = `import-date-order-${index}`;
  const asks = !proposal.settled;
  const asksDate = evidence.dateOrder === "ambiguous";
  const dateOpen = asksDate && !dateOrder;

  // `skip` is offered on every column and is never a candidate on its own
  // (`fields.ts` returns it alone for an empty column). Throwing a column
  // away is a decision the vet is allowed to make about any of them, and
  // saying so out loud is better than leaving them to pick a wrong field.
  const options: ImportField[] = proposal.candidates.includes("skip")
    ? proposal.candidates
    : [...proposal.candidates, "skip"];

  return (
    <Card
      className={cn(
        "self-start",
        // The question cards carry a left rule so a screen of thirty reads
        // as "these ones need me" at a glance. It is never the only signal:
        // every one of them also says so in a sentence, because a colour is
        // not readable to everyone and a rule is not readable at all.
        asks && "border-s-2 border-s-warning",
      )}
    >
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("columnNumber", { number: index + 1 })}
          </p>
          {/* The vet's own heading, unedited. A column with no heading says
              so rather than borrowing the word "Column" as if it had one. */}
          <p className="text-sm font-semibold text-foreground">
            {heading?.trim() ? heading : t("headingNone")}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("samplesLabel")}
          </p>
          {evidence.samples.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("samplesNone")}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {evidence.samples.map((sample, i) => (
                <li
                  key={`${sample}-${i}`}
                  className="truncate text-sm text-foreground"
                  title={sample}
                >
                  {sample}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={selectId}
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            {t("fieldLabel")}
          </label>
          <Select
            id={selectId}
            value={value}
            onChange={(e) => onChange(e.target.value as ImportField | "")}
          >
            {/* An unsettled column starts on nothing. Preselecting the first
                candidate put an answer on screen that nobody gave, under a
                sentence promising the vet would give it -- and the summary
                counted it. The vet says "fine" and `pet.name` becomes a
                decision with no author. Same class as the dash that stood
                where a recorded number should have been (#27): the product
                stating a fact that does not exist. */}
            {asks && (
              <option value="">{t("fieldUnset")}</option>
            )}
            {options.map((field) => (
              <option key={field} value={field}>
                {t(`field.${field}`)}
              </option>
            ))}
          </Select>
          {/* Why this one is first. The product says what it did rather than
              presenting an order as if it had no author (#20). */}
          {proposal.orderedBy && (
            <p className="text-sm text-muted-foreground">
              {t("orderedBy", { heading: proposal.orderedBy })}
            </p>
          )}
          <p className={cn("text-sm", asks ? "text-foreground" : "text-muted-foreground")}>
            {asks ? t("asksYou") : t("settledNote")}
          </p>
          {showUnanswered && asks && value === "" && (
            <Callout variant="warning">{t("fieldUnanswered")}</Callout>
          )}
        </div>

        {/* The file's own habits, reported and not corrected. The vet did not
            know their blanks were written three ways; the product measured
            it and is handing the measurement back. */}
        {evidence.blankCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {evidence.blankMarkers.length > 0
              ? t("blanksWithMarkers", {
                  count: evidence.blankCount,
                  markers: evidence.blankMarkers.join(", "),
                })
              : t("blanks", { count: evidence.blankCount })}
          </p>
        )}
        {evidence.phoneShape === "mixed" && (
          <p className="text-sm text-muted-foreground">{t("phoneMixed")}</p>
        )}

        {asksDate && (
          <fieldset className="flex flex-col gap-2 rounded-control border border-border p-3">
            <legend className="px-1 text-sm font-medium text-foreground">
              {t("dateQuestion", { sample: evidence.samples[0] ?? "" })}
            </legend>
            {/* Two radios and no preselection. The file does not settle this
                and neither does the product: picking one as a default would
                turn a question into an answer nobody gave. */}
            {(["dayFirst", "monthFirst"] as const).map((order) => (
              <label key={order} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name={dateName}
                  value={order}
                  checked={dateOrder === order}
                  onChange={() => onDateOrder(order)}
                  className="size-4"
                />
                {t(`dateOrder.${order}`)}
              </label>
            ))}
            {showUnanswered && dateOpen && (
              <Callout variant="warning">{t("dateUnanswered")}</Callout>
            )}
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
