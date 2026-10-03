"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/format";
import { FIELD_GROUPS, type ImportField, type LooksLike } from "@/modules/import/fields";
import { parseDate } from "@/modules/import/plan";
import type { Cell } from "@/modules/import/read-workbook";

/**
 * One column of the vet's file, as one line: their heading and a few of
 * their own values on the left, where it goes in PetTrack on the right.
 *
 * A line rather than a card, and the reason is reading: twelve columns as
 * twelve cards was a page of boxes that each said the same four things,
 * and the one fact the vet came for -- "where does this go" -- sat in the
 * fourth line of every box. As a list it is one glance down the right edge.
 *
 * The values are THEIR values, never masked and never tidied: a phone with
 * its spaces, a date as they typed it -- and, for a date, how we read it,
 * because "05/06/2022" is two days and only the second half of
 * "05/06/2022 → 5 Haziran 2022" says which one we will write.
 */

/** Where the line's current answer came from, for the dot and its label. */
export type AnswerSource =
  | "recognized"
  | "ai_high"
  | "ai_medium"
  | "ai_low"
  | "you"
  | "skip"
  | "open";

export type Proposal = {
  field: ImportField;
  why: LooksLike | "ai" | "heading";
  reason?: string;
};

export function MappingRow({
  col,
  heading,
  cells,
  admitted,
  value,
  source,
  proposal,
  vaccineName,
  onVaccineName,
  dateOrder,
  onChange,
  showProblem,
  warning,
}: {
  col: number;
  heading?: string;
  /** The column's non-blank body cells, for the samples. */
  cells: readonly Cell[];
  /** The fields this column's values allow, best first. */
  admitted: readonly ImportField[];
  value: ImportField | "";
  source: AnswerSource;
  proposal?: Proposal;
  vaccineName: string;
  onVaccineName: (name: string) => void;
  dateOrder?: "dayFirst" | "monthFirst";
  onChange: (field: ImportField | "") => void;
  showProblem: boolean;
  /** A column that is being left out but has something worth keeping. */
  warning?: { text: string; action?: { label: string; run: () => void } };
}) {
  const t = useTranslations("import");
  const locale = useLocale();
  const name = heading?.trim() ? heading.trim() : t("noHeading", { number: col + 1 });
  const selectId = `import-column-${col}`;
  const isDate = value === "pet.birthDate" || value.startsWith("vaccine.") && value !== "vaccine.name";

  const samples = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const cell of cells) {
      const raw = cell.text.trim();
      if (raw === "" || seen.has(raw)) continue;
      seen.add(raw);
      if (isDate) {
        const shown = cell.source === "date" ? excelDay(raw) : raw;
        const read = parseDate(raw, dateOrder);
        out.push(read ? `${shown} → ${formatDateOnly(locale, read)}` : shown);
      } else {
        out.push(raw);
      }
      if (out.length >= 3) break;
    }
    return out;
  }, [cells, isDate, dateOrder, locale]);

  const groups = FIELD_GROUPS.map((group) => ({
    group: group.group,
    fields: group.fields.filter((f) => admitted.includes(f)),
  })).filter((g) => g.fields.length > 0);

  return (
    <li
      className="grid min-w-0 gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-start"
      data-column={col}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="break-words text-sm font-medium text-foreground">{name}</p>
        <p className="break-words text-sm text-muted-foreground">
          {samples.length > 0 ? samples.join("  ·  ") : t("emptyColumn")}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ConfidenceDot source={source} />
          <label htmlFor={selectId} className="sr-only">
            {t("pickerLabel", { heading: name })}
          </label>
          <div className="min-w-0 flex-1">
          <Select
            id={selectId}
            value={value}
            onChange={(e) => onChange(e.target.value as ImportField | "")}
            aria-invalid={showProblem && value === "" ? true : undefined}
          >
            {value === "" && <option value="">{t("pickerPlaceholder")}</option>}
            {groups.map((group) => (
              <optgroup key={group.group} label={t(`group.${group.group}`)}>
                {group.fields.map((field) => (
                  <option key={field} value={field}>
                    {t(`field.${field}` as never)}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label={t("group.other")}>
              <option value="skip">{t("pickerSkip")}</option>
            </optgroup>
          </Select>
          </div>
        </div>

        {value === "vaccine.column" && (
          <div className="flex min-w-0 items-center gap-2 ps-4">
            <label htmlFor={`import-vaccine-${col}`} className="shrink-0 text-sm text-muted-foreground">
              {t("vaccineNameLabel")}
            </label>
            <Input
              id={`import-vaccine-${col}`}
              value={vaccineName}
              maxLength={80}
              className="h-9 min-w-0 flex-1"
              onChange={(e) => onVaccineName(e.target.value)}
            />
          </div>
        )}

        {value === "" && proposal && (
          <button
            type="button"
            onClick={() => onChange(proposal.field)}
            className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1 text-start text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {proposal.why === "ai" && <Sparkles className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="min-w-0 break-words">
              {t(`looksLike.${proposal.why}`)} · {t("chipApply", { field: t(`field.${proposal.field}` as never) })}
            </span>
          </button>
        )}
        {value === "" && proposal?.reason && (
          <p className="break-words text-xs text-muted-foreground">{proposal.reason}</p>
        )}

        {showProblem && value === "" && (
          <p className="text-sm text-warning">{t("fieldUnanswered")}</p>
        )}

        {warning && (
          <Callout variant="warning" className="flex-wrap">
            <span className="min-w-0 break-words">{warning.text}</span>
            {warning.action && (
              <button
                type="button"
                onClick={warning.action.run}
                className="font-medium underline underline-offset-2"
              >
                {warning.action.label}
              </button>
            )}
          </Callout>
        )}
      </div>
    </li>
  );
}

/** An Excel date cell, the way Turkish Excel shows one by default. */
function excelDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * Where the answer came from, as a dot -- never only a dot. The label is
 * on the element for a screen reader and on hover for a mouse, and the
 * line around it says the same thing in words when it matters (an open
 * column says so under its picker).
 */
function ConfidenceDot({ source }: { source: AnswerSource }) {
  const t = useTranslations("import");
  const label = source === "open" ? t("fieldUnanswered") : t(`confidence.${source}`);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "size-2 shrink-0 rounded-pill",
        source === "recognized" || source === "ai_high" || source === "you"
          ? "bg-primary"
          : source === "skip"
            ? "border border-muted-foreground bg-transparent"
            : "bg-warning",
      )}
    />
  );
}
