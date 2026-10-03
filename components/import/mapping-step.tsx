"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Select } from "@/components/ui/select";
import { surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FIELD_GROUP,
  IMPORT_FIELDS,
  missingRequired,
  type ColumnMapping,
  type ImportField,
} from "@/modules/import/fields";

/** 0 → "A", 25 → "Z", 26 → "AA": the letter Excel shows above the column. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const GROUPS = ["owner", "pet", "vaccine"] as const;
const GROUP_LABEL = { owner: "groupOwner", pet: "groupPet", vaccine: "groupVaccine" } as const;

export function MappingStep({
  fileName,
  sheetName,
  rows,
  headers,
  samples,
  mapping,
  onChange,
  onBack,
  onNext,
  announce,
}: {
  fileName: string;
  sheetName: string | null;
  rows: number;
  headers: string[];
  samples: string[][];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
  announce: (message: string) => void;
}) {
  const t = useTranslations("import");
  const missing = missingRequired(mapping);
  const matched = mapping.filter(Boolean).length;
  const name = (i: number) =>
    headers[i]?.trim() ? headers[i] : t("map.unnamed", { letter: columnLetter(i) });

  const choose = (column: number, value: string) => {
    const field = value === "" ? null : (value as ImportField);
    const next = [...mapping];
    // A field is read from one column. Choosing it here takes it from
    // wherever it was, and says so, rather than refusing the choice.
    const previous = field ? next.indexOf(field) : -1;
    if (previous !== -1 && previous !== column) {
      next[previous] = null;
      announce(t("map.moved", { field: t(`fields.${field}`), column: name(column) }));
    }
    next[column] = field;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        {t("map.file", { name: fileName, rows })} · {t("map.matched", { count: matched })}
      </p>

      {sheetName && (
        <Callout variant="info">{t("map.sheet", { sheet: sheetName })}</Callout>
      )}

      <ul className={cn(surface, "divide-y divide-border")}>
        {headers.map((_, column) => {
          const field = mapping[column];
          const selectId = `import-column-${column}`;
          return (
            <li
              key={column}
              className={cn(
                "grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-center",
                !field && "bg-muted/20",
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <label htmlFor={selectId} className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-control bg-muted px-1 font-mono text-[11px] text-muted-foreground"
                  >
                    {columnLetter(column)}
                  </span>
                  <span className="truncate">{name(column)}</span>
                </label>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="sr-only">{t("map.samples")}: </span>
                  {samples[column]?.length ? samples[column].join(" · ") : t("map.noSamples")}
                </p>
              </div>
              <Select
                id={selectId}
                value={field ?? ""}
                onChange={(e) => choose(column, e.target.value)}
                className={cn(!field && "text-muted-foreground")}
              >
                <option value="">{t("map.skip")}</option>
                {GROUPS.map((group) => (
                  <optgroup key={group} label={t(`map.${GROUP_LABEL[group]}`)}>
                    {IMPORT_FIELDS.filter((f) => FIELD_GROUP[f] === group).map((f) => (
                      <option key={f} value={f}>
                        {t(`fields.${f}`)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2" aria-live="polite">
        {missing.length > 0 ? (
          <Callout variant="warning" live={false}>
            {t("map.required", {
              fields: missing.map((f) => t(`fields.${f}`)).join(", "),
            })}
          </Callout>
        ) : (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            {t("map.requiredOk")}
          </p>
        )}
        {missing.length === 0 && !mapping.includes("phone") && (
          <Callout variant="info">{t("map.noPhone")}</Callout>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t("actions.changeFile")}
        </Button>
        <Button type="button" onClick={onNext} disabled={missing.length > 0}>
          {t("actions.toPreview")}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
