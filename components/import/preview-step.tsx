"use client";

import * as React from "react";
import { ArrowLeft, CalendarDays, Loader2, PawPrint, ShieldCheck, Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPlainDate } from "@/lib/format";
import type { Analysis, AnalyzedRow, OwnerPlan, RowStatus } from "@/modules/import/analyze";
import { issueText } from "./issue-text";

export type SpeciesOption = { value: string; label: string };

type Filter = "issues" | "skipped" | "all";

const PAGE = 100;

const STATUS_LABEL: Record<RowStatus, string> = {
  ready: "statusReady",
  warning: "statusWarning",
  error: "statusError",
  duplicate: "statusDuplicate",
};

/** A segmented single choice, the shape `ThemeToggle` settled (aria-pressed, all enabled). */
function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PreviewStep({
  analysis,
  updating,
  builtInSpecies,
  customSpecies,
  dateOrder,
  speciesChoices,
  onDateOrder,
  onSpeciesChoice,
  onBack,
  onImport,
  error,
}: {
  analysis: Analysis;
  updating: boolean;
  builtInSpecies: SpeciesOption[];
  customSpecies: { id: string; name: string }[];
  dateOrder: "DMY" | "MDY" | null;
  speciesChoices: Record<string, string>;
  onDateOrder: (order: "DMY" | "MDY") => void;
  onSpeciesChoice: (key: string, choice: string) => void;
  onBack: () => void;
  onImport: () => void;
  error: string | null;
}) {
  const t = useTranslations("import");
  const tFlat = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const { counts, dates } = analysis;
  const owners = React.useMemo(
    () => new Map<string, OwnerPlan>(analysis.owners.map((o) => [o.id, o])),
    [analysis.owners],
  );
  const speciesLabel = React.useMemo(
    () => new Map(builtInSpecies.map((s) => [s.value, s.label])),
    [builtInSpecies],
  );

  const issueRows = counts.warnings + counts.skipped;
  const [filter, setFilter] = React.useState<Filter>(issueRows > 0 ? "issues" : "all");
  const [limit, setLimit] = React.useState(PAGE);

  const filtered = analysis.rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "skipped"
        ? r.status === "error" || r.status === "duplicate"
        : r.status !== "ready",
  );
  const shown = filtered.slice(0, limit);

  const ambiguousExample = analysis.rows
    .flatMap((r) => r.issues)
    .find((i) => i.code === "dateAmbiguous");
  // The first ambiguous value in the file, read both ways, so the choice
  // is made against the clinic's own data rather than an abstract format.
  const sample = ambiguousExample && "raw" in ambiguousExample ? ambiguousExample.raw : "03/04/2020";
  const sampleParts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(sample);
  const readAs = (order: "DMY" | "MDY") => {
    if (!sampleParts) return "";
    const [, a, b, y] = sampleParts;
    const year = y.length === 2 ? `20${y}` : y;
    const [d, m] = order === "DMY" ? [a, b] : [b, a];
    return formatPlainDate(locale, `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  };

  const date = (iso: string | null) => (iso ? formatPlainDate(locale, iso) : null);

  const columns: Column<AnalyzedRow>[] = [
    {
      key: "line",
      header: t("preview.line"),
      numeric: true,
      cell: (r) => <span className="text-muted-foreground">{r.line}</span>,
    },
    {
      key: "status",
      header: t("preview.status"),
      cell: (r) => (
        <StatusBadge kind="importRow" status={r.status} label={t(`preview.${STATUS_LABEL[r.status]}` as never)} />
      ),
      cellClassName: "whitespace-nowrap",
    },
    {
      key: "owner",
      header: t("preview.owner"),
      cellClassName: "min-w-44",
      cell: (r) => {
        const owner = r.ownerId ? owners.get(r.ownerId) : undefined;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{owner ? `${owner.firstName} ${owner.lastName}` : r.ownerLabel || "-"}</span>
            {owner?.phone && <span className="text-xs tabular-nums text-muted-foreground">{owner.phone}</span>}
            {owner?.existing && (
              <Badge
                variant="primary"
                className="w-fit"
                title={t("preview.existingClientTitle", { name: owner.existing.name })}
              >
                {t("preview.existingClient")}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "pet",
      header: t("preview.pet"),
      cellClassName: "min-w-44",
      cell: (r) => {
        const p = r.pet;
        if (!p) return <span className="text-muted-foreground">{r.petLabel || "-"}</span>;
        const species =
          p.species.kind === "builtIn" ? speciesLabel.get(p.species.species) ?? p.species.species : p.species.name;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {[species, p.breed, date(p.birthDate)].filter(Boolean).join(" · ")}
            </span>
            {r.vaccine && (
              <span className="text-xs text-muted-foreground">
                {t("preview.vaccine", { name: r.vaccine.name, date: date(r.vaccine.date) ?? "" })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "details",
      header: t("preview.details"),
      cellClassName: "min-w-64",
      cell: (r) =>
        r.issues.length === 0 ? (
          <span className="text-muted-foreground">{t("preview.noIssues")}</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {r.issues.map((issue, i) => (
              <li key={i} className="text-xs text-foreground">
                {issueText(tFlat, issue)}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const stats = [
    { key: "statPets", value: counts.pets },
    { key: "statNewClients", value: counts.newClients },
    { key: "statExisting", value: counts.existingClients },
    { key: "statVaccines", value: counts.vaccinations },
    { key: "statSkipped", value: counts.skipped },
  ] as const;

  return (
    <div aria-busy={updating} className="flex flex-col gap-5">
      {error && <Callout variant="danger">{error}</Callout>}

      {/* The sentence first, then the figures it is made of. */}
      <div className={cn(surface, "flex flex-col gap-4 p-4 sm:p-5")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-foreground">
          {counts.pets > 0
            ? t("preview.summary", { pets: counts.pets, clients: counts.newClients + counts.existingClients })
            : t("preview.summaryNone")}
          {counts.skipped > 0 && (
            <span className="font-normal text-muted-foreground">
              · {t("preview.summarySkipped", { count: counts.skipped })}
            </span>
          )}
          {updating && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("preview.updating")} />}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.key} className="rounded-tile bg-muted/40 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{t(`preview.${s.key}`)}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
        {counts.existingClients > 0 && (
          <p className="text-xs text-muted-foreground">{t("preview.existingNote")}</p>
        )}
      </div>

      <Callout variant="info" title={t("preview.consentTitle")}>
        {t("preview.consentBody")}
      </Callout>

      {dates.ambiguous > 0 && (
        <div className={cn(surface, "flex flex-col gap-3 p-4 sm:p-5")}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-warning/10 text-warning">
              <CalendarDays className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">{t("preview.datesTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {dateOrder
                  ? t("preview.datesChosen", { count: dates.ambiguous })
                  : t("preview.datesBody", { count: dates.ambiguous, example: sample })}
              </p>
              {(dates.evidence.dmy > 0 || dates.evidence.mdy > 0) && (
                <p className="text-xs text-muted-foreground">
                  {t("preview.datesEvidence", dates.evidence)}
                </p>
              )}
            </div>
          </div>
          <Segments
            label={t("preview.dateOrder")}
            value={dateOrder}
            onChange={onDateOrder}
            options={(["DMY", "MDY"] as const).map((order) => ({
              value: order,
              label: (
                <>
                  {t(order === "DMY" ? "preview.dmy" : "preview.mdy")}
                  <span className="font-normal opacity-80">
                    {" · "}
                    {t("preview.orderExample", { raw: sample, date: readAs(order) })}
                  </span>
                </>
              ),
            }))}
          />
        </div>
      )}

      {analysis.species.length > 0 && (
        <div className={cn(surface, "flex flex-col gap-3 p-4 sm:p-5")}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-accent text-accent-foreground">
              <Tag className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">{t("preview.speciesTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("preview.speciesBody")}</p>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {analysis.species.map((q) => (
              <li key={q.key} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center">
                <label htmlFor={`species-${q.key}`} className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{q.label}</span>
                  <span className="text-xs text-muted-foreground">{t("preview.speciesRows", { count: q.rows })}</span>
                </label>
                <Select
                  id={`species-${q.key}`}
                  aria-label={t("preview.speciesFor", { name: q.label })}
                  value={speciesChoices[q.key] ?? q.choice}
                  onChange={(e) => onSpeciesChoice(q.key, e.target.value)}
                >
                  <option value="new">{t("preview.speciesNew", { name: q.label })}</option>
                  <optgroup label={t("preview.speciesBuiltIn")}>
                    {builtInSpecies.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                  {customSpecies.length > 0 && (
                    <optgroup label={t("preview.speciesCustom")}>
                      {customSpecies.map((c) => (
                        <option key={c.id} value={`custom:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Segments<Filter>
          label={t("preview.filterLabel")}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setLimit(PAGE);
          }}
          options={[
            { value: "issues", label: `${t("preview.filterIssues")} · ${issueRows}` },
            { value: "skipped", label: `${t("preview.filterSkipped")} · ${counts.skipped}` },
            { value: "all", label: `${t("preview.filterAll")} · ${counts.rows}` },
          ]}
        />

        {filtered.length === 0 ? (
          <div className={cn(surface, "flex items-center gap-3 px-4 py-6")}>
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-pill bg-accent text-accent-foreground">
              {filter === "all" ? <PawPrint className="size-4" /> : <ShieldCheck className="size-4" />}
            </span>
            <p className="text-sm text-muted-foreground">
              {filter === "issues" ? t("preview.allClear") : t("preview.emptyFilter")}
            </p>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-2 transition-opacity", updating && "opacity-60")}>
            <p className="text-xs text-muted-foreground sm:hidden">{t("preview.scrollHint")}</p>
            <DataTable
              rows={shown}
              rowKey={(r) => String(r.line)}
              columns={columns}
              caption={t("preview.caption")}
            />
            {filtered.length > shown.length && (
              <Button
                type="button"
                variant="secondary"
                className="self-center"
                onClick={() => setLimit((l) => l + PAGE)}
              >
                {t("preview.showMore", { count: Math.min(PAGE, filtered.length - shown.length) })}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={cn(surface, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5")}>
        <p className="text-xs text-muted-foreground sm:max-w-sm">{t("run.confirmHint")}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {t("actions.back")}
          </Button>
          <Button type="button" onClick={onImport} disabled={counts.pets === 0 || updating}>
            {t("run.confirm", { pets: counts.pets })}
          </Button>
        </div>
      </div>
    </div>
  );
}
