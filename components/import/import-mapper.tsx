"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/format";
import { MappingRow, type AnswerSource, type Proposal } from "@/components/import/mapping-row";
import { ImportReview, type ReviewInput } from "@/components/import/import-review";
import { classifyColumn, isBlank, type ColumnEvidence } from "@/modules/import/infer";
import {
  DATE_FIELDS,
  hintsFor,
  propose,
  suggestMapping,
  vaccineFromHeading,
  type ColumnSuggestion,
  type ImportField,
} from "@/modules/import/fields";
import { parseDate } from "@/modules/import/plan";
import { mask } from "@/modules/import/mask";
import { readImportFile, ReadFileError, type ReadFailure } from "@/modules/import/read-file";
import type { AiSuggestion } from "@/modules/import/ai-match";
import type { Cell, SheetTable } from "@/modules/import/read-workbook";
import { headerEvidence } from "@/modules/import/read-workbook";

/**
 * The import, start to finish: the file, its columns, a check, the result.
 *
 * WHAT THE VET DOES ON A CLEAN FILE: picks it, reads "we matched all 17
 * columns", presses Continue. Every column whose heading and values agree
 * arrives matched (`suggestMapping`), and the ones the product cannot name
 * are asked -- first of a model when one is configured (headings and
 * masked samples only, `ai-match.ts`), then of the vet, with the proposal
 * as one tap. The owner's sentence that shaped this: a template-like file
 * must map itself, and a person should only touch the exceptions.
 *
 * WHY THE FILE IS READ HERE. In the browser, so nothing is uploaded and no
 * file is too big to pick (`read-file.ts`). What goes to the server is the
 * rows of the columns being imported, compressed (`transport.ts`), and the
 * server rebuilds the plan from them against the clinic's own clients.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "failed"; reason: ReadFailure | "unexpected" }
  | { kind: "read"; sheets: SheetTable[] };

type HeaderAnswer = "names" | "record";

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; byCol: Record<number, AiSuggestion> }
  | { status: "off" };

type Column = {
  col: number;
  heading?: string;
  evidence: ColumnEvidence;
  values: string[];
  cells: Cell[];
  admitted: ImportField[];
};

export function ImportMapper({ aiAvailable = false }: { aiAvailable?: boolean }) {
  const t = useTranslations("import");
  const locale = useLocale();
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [fileName, setFileName] = React.useState("");
  const [sheetIndex, setSheetIndex] = React.useState(0);
  const [includeTitleRows, setIncludeTitleRows] = React.useState(false);
  const [headerAnswer, setHeaderAnswer] = React.useState<HeaderAnswer | null>(null);
  const [fields, setFields] = React.useState<Record<number, ImportField | "">>({});
  const [vaccineNames, setVaccineNames] = React.useState<Record<number, string>>({});
  const [dateOrder, setDateOrder] = React.useState<"dayFirst" | "monthFirst" | null>(null);
  const [ai, setAi] = React.useState<AiState>({ status: "idle" });
  const [showProblems, setShowProblems] = React.useState(false);
  const [stage, setStage] = React.useState<"map" | "review">("map");
  const [dragging, setDragging] = React.useState(false);
  const failureRef = React.useRef<HTMLDivElement>(null);
  const problemRef = React.useRef<HTMLDivElement>(null);

  function resetAnswers() {
    setHeaderAnswer(null);
    setFields({});
    setVaccineNames({});
    setDateOrder(null);
    setAi({ status: "idle" });
    setShowProblems(false);
    setStage("map");
    setIncludeTitleRows(false);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    setSheetIndex(0);
    resetAnswers();
    setPhase({ kind: "reading" });
    try {
      const sheets = await readImportFile(file);
      // The first sheet with something in it: a workbook whose first tab is
      // an empty "Sayfa1" is the common case, not the odd one.
      const first = sheets.findIndex((s) => s.rows.some((r) => r.some((c) => c.text.trim() !== "")));
      setSheetIndex(Math.max(0, first));
      setPhase({ kind: "read", sheets });
    } catch (error) {
      setPhase({
        kind: "failed",
        reason: error instanceof ReadFileError ? error.reason : "unexpected",
      });
    }
  }

  // After a failed read the focus would otherwise fall to the body: the
  // sentence that explains why nothing happened has to be where a keyboard
  // or a screen reader is.
  React.useEffect(() => {
    if (phase.kind === "failed") failureRef.current?.focus();
  }, [phase]);

  const sheets = React.useMemo(() => (phase.kind === "read" ? phase.sheets : []), [phase]);
  const sheet: SheetTable | undefined = sheets[sheetIndex];

  const titleRows = React.useMemo(() => (sheet ? leadingTitleRows(sheet) : 0), [sheet]);
  const skipTop = includeTitleRows ? 0 : titleRows;
  const tableRows: Cell[][] = React.useMemo(
    () => (sheet ? sheet.rows.slice(skipTop) : []),
    [sheet, skipTop],
  );

  const evidence = React.useMemo(() => headerEvidence(tableRows), [tableRows]);
  const hintedHeadings = React.useMemo(
    () =>
      (tableRows[0] ?? []).filter((c) => c.source === "text" && hintsFor(c.text).length > 0)
        .length,
    [tableRows],
  );
  // A first row whose words name fields ("Telefon", "Hayvan Adı") or whose
  // cells differ in kind from the values under them is headings; the
  // screen says so and offers the other reading in one tap. Only a row
  // nothing can tell about is a question asked before anything else.
  const proposedHeader: HeaderAnswer | null =
    evidence.looksLikeHeader || hintedHeadings >= 2 ? "names" : null;
  const header = headerAnswer ?? proposedHeader;

  const bodyRows: Cell[][] = React.useMemo(
    () => (header === "names" ? tableRows.slice(1) : tableRows),
    [tableRows, header],
  );

  const columns: Column[] = React.useMemo(() => {
    if (!sheet || header === null) return [];
    const headings = header === "names" ? (tableRows[0] ?? []) : [];
    return Array.from({ length: sheet.columnCount }, (_, col) => {
      const values = bodyRows.map((row) => row[col]?.text ?? "");
      const ev = classifyColumn(values);
      const heading = headings[col]?.text;
      return {
        col,
        heading,
        evidence: ev,
        values: values.filter((v) => !isBlank(v)),
        cells: bodyRows
          .map((row) => row[col])
          .filter((c): c is Cell => !!c && !isBlank(c.text)),
        admitted: propose(ev, heading).candidates.filter((f) => f !== "skip"),
      };
    });
  }, [sheet, header, tableRows, bodyRows]);

  const suggestions: Record<number, ColumnSuggestion> = React.useMemo(() => {
    const out: Record<number, ColumnSuggestion> = {};
    for (const s of suggestMapping(columns)) out[s.col] = s;
    return out;
  }, [columns]);

  // The columns the product could not name, asked of a model once per
  // reading of the sheet. Masked here AND on the server: the screen's
  // masking is a courtesy, the server's is the control.
  const unresolved = React.useMemo(
    () =>
      columns.filter(
        (c) => c.evidence.kind !== "empty" && suggestions[c.col]?.confidence !== "recognized",
      ),
    [columns, suggestions],
  );
  // Keyed by WHICH columns are open, so a new header answer or sheet asks
  // again and a re-render does not. The status is not a dependency: it is
  // what this effect sets, and depending on it cancelled the request it
  // had just started (measured: the screen sat on "looking..." forever).
  const unresolvedKey = unresolved.map((c) => `${c.col}:${c.heading ?? ""}`).join("|");
  React.useEffect(() => {
    if (!aiAvailable || unresolved.length === 0) return;
    let cancelled = false;
    // Starting the request is the effect's whole job.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAi({ status: "loading" });
    fetch("/api/import/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        columns: unresolved.map((c) => ({
          columnIndex: c.col,
          heading: c.heading ?? "",
          kind: c.evidence.kind,
          samples: c.values.slice(0, 5).map((v) => mask(v)),
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { available?: boolean; suggestions?: AiSuggestion[] } | null) => {
        if (cancelled) return;
        if (!data?.available) return setAi({ status: "off" });
        const byCol: Record<number, AiSuggestion> = {};
        for (const s of data.suggestions ?? []) byCol[s.columnIndex] = s;
        setAi({ status: "done", byCol });
      })
      .catch(() => {
        if (!cancelled) setAi({ status: "off" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAvailable, unresolvedKey]);

  /** One column's answer, where it came from, and what is proposed if open. */
  const answerOf = (
    column: Column,
  ): { value: ImportField | ""; source: AnswerSource; proposal?: Proposal } => {
    const own = fields[column.col];
    if (own !== undefined) {
      return { value: own, source: own === "" ? "open" : own === "skip" ? "skip" : "you" };
    }
    const s = suggestions[column.col];
    if (s?.confidence === "recognized" && s.field) {
      return { value: s.field, source: s.field === "skip" ? "skip" : "recognized" };
    }
    const fromAi = ai.status === "done" ? ai.byCol[column.col] : undefined;
    // Rule one holds for the model too: a field the values do not admit is
    // not an answer, however sure the model was.
    if (fromAi?.field && (fromAi.field === "skip" || column.admitted.includes(fromAi.field))) {
      if (fromAi.confidence === "high") {
        return { value: fromAi.field, source: fromAi.field === "skip" ? "skip" : "ai_high" };
      }
      return {
        value: "",
        source: fromAi.confidence === "medium" ? "ai_medium" : "ai_low",
        proposal: { field: fromAi.field, why: "ai", reason: fromAi.reason },
      };
    }
    if (s?.confidence === "suggested" && s.field && column.admitted.includes(s.field)) {
      return { value: "", source: "open", proposal: { field: s.field, why: s.looksLike ?? "heading" } };
    }
    return { value: "", source: "open" };
  };

  const vaccineNameOf = (col: number, heading?: string): string =>
    vaccineNames[col] ??
    (ai.status === "done" ? ai.byCol[col]?.vaccineName : null) ??
    suggestions[col]?.vaccineName ??
    vaccineFromHeading(heading) ??
    (heading?.trim() || "");

  const answered = columns.map((c) => ({ column: c, ...answerOf(c) }));
  const mapping: Record<number, ImportField> = {};
  for (const a of answered) if (a.value !== "") mapping[a.column.col] = a.value;

  // A column being left out that has vaccination dates, or dates, in it.
  // The vet's condition for switching: a rabies date is never lost
  // quietly. So it is said on the line itself, the line goes to the top,
  // and "everything matched" is not said while it stands.
  const leftOutWithDates = answered.filter(
    (a) =>
      a.value === "skip" &&
      a.column.evidence.kind !== "empty" &&
      (a.column.evidence.kind === "date" || vaccineFromHeading(a.column.heading) !== null),
  );
  const open = answered.filter((a) => a.value === "");
  const attention = new Set([...open, ...leftOutWithDates].map((a) => a.column.col));
  const matchedCount = columns.length - attention.size;

  const ambiguous = answered.filter(
    (a) =>
      a.value !== "" && DATE_FIELDS.has(a.value) && a.column.evidence.dateOrder === "ambiguous",
  );
  const sampleDate = ambiguous
    .flatMap((a) => a.column.values)
    .find((v) => /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v.trim()));

  const hasOwner = Object.values(mapping).includes("client.firstName");
  const hasPet = Object.values(mapping).includes("pet.name");
  const dateOpen = ambiguous.length > 0 && !dateOrder;
  const blocking = open.length > 0 || dateOpen || !hasOwner || !hasPet;

  const [reviewInput, setReviewInput] = React.useState<ReviewInput | null>(null);

  function onContinue() {
    if (blocking || !sheet || header === null) {
      setShowProblems(true);
      requestAnimationFrame(() => problemRef.current?.focus());
      return;
    }
    const dateOrders: Record<number, "dayFirst" | "monthFirst"> = {};
    if (dateOrder) for (const a of ambiguous) dateOrders[a.column.col] = dateOrder;
    const names: Record<number, string> = {};
    for (const a of answered) {
      if (a.value === "vaccine.column") names[a.column.col] = vaccineNameOf(a.column.col, a.column.heading);
    }
    setReviewInput({
      fileName,
      sheetIndex,
      headerRow: header === "names",
      table: tableRows.map((row) => row.map((cell) => cell.text)),
      mapping,
      dateOrders,
      vaccineNames: names,
      firstRowNumber: skipTop + (header === "names" ? 2 : 1),
    });
    setStage("review");
    window.scrollTo({ top: 0 });
  }

  const readFailure =
    phase.kind === "failed"
      ? phase.reason === "legacyXls"
        ? t("failedLegacyXls")
        : phase.reason === "unreadable"
          ? t("failedUnreadable")
          : t("failedUnexpected")
      : null;

  const fileInput = (
    <input
      id="import-file"
      type="file"
      accept=".xlsx,.csv,.txt,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void onFile(file);
        // The same file picked twice is a second attempt, not nothing.
        e.target.value = "";
      }}
    />
  );

  if (stage === "review" && reviewInput) {
    return (
      <div className="flex flex-col gap-6">
        {fileInput}
        <ImportReview input={reviewInput} onBack={() => setStage("map")} />
      </div>
    );
  }

  const rowProps = (a: (typeof answered)[number]) => ({
    col: a.column.col,
    heading: a.column.heading,
    cells: a.column.cells,
    admitted: a.column.admitted,
    value: a.value,
    source: a.source,
    proposal: a.proposal,
    vaccineName: vaccineNameOf(a.column.col, a.column.heading),
    onVaccineName: (name: string) => setVaccineNames((p) => ({ ...p, [a.column.col]: name })),
    dateOrder: dateOrder ?? undefined,
    onChange: (field: ImportField | "") => setFields((p) => ({ ...p, [a.column.col]: field })),
    showProblem: showProblems,
  });

  return (
    <div className="flex flex-col gap-6">
      {fileInput}

      {phase.kind !== "read" ? (
        <Card
          className={cn("border-dashed transition-colors", dragging && "border-primary bg-accent/40")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-pill bg-accent text-accent-foreground">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-foreground">{t("dropTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {/* Only where there is something to drag with: a phone has no
                    desktop to drag a file from, and telling it to drop one is
                    a sentence about a gesture it cannot make. */}
                <span className="hidden [@media(pointer:fine)]:inline">{t("dropOr")} · </span>
                {t("fileFormats")}
              </p>
            </div>
            <label
              htmlFor="import-file"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "cursor-pointer has-[:focus-visible]:outline-2",
              )}
            >
              {t("chooseFile")}
            </label>
            {phase.kind === "reading" && (
              <p className="text-sm text-muted-foreground" role="status">
                {t("reading")}
              </p>
            )}
            {readFailure && (
              <Callout ref={failureRef} tabIndex={-1} variant="danger" className="text-start">
                {readFailure}
              </Callout>
            )}
            <div className="flex flex-col items-center gap-1 pt-2">
              <a
                href="/api/import/template"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("template")}
              </a>
              <p className="max-w-md text-xs text-muted-foreground">{t("templateHint")}</p>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">{t("privacy")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <FileSpreadsheet className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="break-words text-sm font-medium text-foreground">{fileName}</p>
            {sheet && (
              <p className="text-sm text-muted-foreground">
                {t("fileLine", { rows: bodyRows.length, columns: sheet.columnCount })}
              </p>
            )}
          </div>
          <label
            htmlFor="import-file"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "cursor-pointer")}
          >
            {t("otherFile")}
          </label>
        </div>
      )}

      {phase.kind === "read" && sheets.length === 0 && (
        <EmptyState icon={Upload} title={t("emptyBook")} description={t("emptyBookHint")} />
      )}

      {sheets.length > 1 && (
        <div className="flex flex-col gap-2 sm:max-w-sm">
          <label htmlFor="import-sheet" className="text-sm font-medium text-foreground">
            {t("sheetQuestion")}
          </label>
          <Select
            id="import-sheet"
            value={String(sheetIndex)}
            onChange={(e) => {
              setSheetIndex(Number(e.target.value));
              resetAnswers();
            }}
          >
            {sheets.map((s, i) => (
              <option key={`${s.name}-${i}`} value={i}>
                {t("sheetOption", { name: s.name, rows: s.rows.length })}
              </option>
            ))}
          </Select>
        </div>
      )}

      {sheet && sheet.rows.length === 0 && (
        <EmptyState icon={Upload} title={t("emptySheet")} description={t("emptySheetHint")} />
      )}

      {sheet && tableRows.length > 0 && (
        <div className="flex flex-col gap-2">
          {titleRows > 0 && !includeTitleRows && (
            <p className="text-sm text-muted-foreground">
              {t("titleRowsSkipped", { count: titleRows })}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setIncludeTitleRows(true);
                  setFields({});
                  setAi({ status: "idle" });
                }}
              >
                {t("titleRowsInclude")}
              </button>
            </p>
          )}

          {header === null ? (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                {/* The row itself while it is being asked about: classifying a
                    row nobody can see is guessing. */}
                <div className="overflow-x-auto">
                  <ul className="flex w-max gap-2">
                    {(tableRows[0] ?? []).map((cell, i) => (
                      <li
                        key={i}
                        className="max-w-40 truncate rounded-control border border-border px-2 py-1 text-sm text-foreground"
                        title={cell.text}
                      >
                        {cell.text.trim() === "" ? "·" : cell.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-foreground">{t("headerQuestion")}</legend>
                  {(["names", "record"] as const).map((answer) => (
                    <label key={answer} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="import-header"
                        value={answer}
                        checked={false}
                        onChange={() => setHeaderAnswer(answer)}
                        className="size-4"
                      />
                      {t(`headerOption.${answer}`)}
                    </label>
                  ))}
                </fieldset>
                <p className="text-sm text-muted-foreground">{t("headerCannotTell")}</p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              {header === "names" ? t("headerAssumed") : t("headerAssumedRecord")}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setHeaderAnswer(header === "names" ? "record" : "names");
                  setFields({});
                  setAi({ status: "idle" });
                }}
              >
                {header === "names" ? t("headerSwitchToRecord") : t("headerSwitchToNames")}
              </button>
            </p>
          )}
        </div>
      )}

      {columns.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="import-map-title">
          <div className="flex flex-col gap-1">
            <h2 id="import-map-title" className="text-lg font-semibold tracking-tight text-foreground">
              {t("mapTitle")}
            </h2>
            <p className="text-sm text-foreground" aria-live="polite">
              {attention.size === 0
                ? t("mapAllMatched", { total: columns.length })
                : t("mapSomeOpen", {
                    total: columns.length,
                    matched: matchedCount,
                    open: attention.size,
                  })}
            </p>
            {ai.status === "loading" && (
              <p className="text-sm text-muted-foreground" role="status">
                {t("aiWorking")}
              </p>
            )}
            {(ai.status === "loading" || ai.status === "done") && (
              <p className="text-xs text-muted-foreground">{t("aiPrivacy")}</p>
            )}
          </div>

          {ambiguous.length > 0 && sampleDate && (
            <fieldset
              className={cn(
                "flex min-w-0 flex-col gap-3 rounded-surface border bg-card p-4",
                showProblems && dateOpen ? "border-warning" : "border-border",
              )}
            >
              <legend className="sr-only">{t("dateOrderTitle")}</legend>
              <p className="text-sm font-medium text-foreground">
                {t("dateOrderQuestion", { sample: sampleDate })}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["dayFirst", "monthFirst"] as const).map((order) => {
                  const read = parseDate(sampleDate, order);
                  return (
                    <label
                      key={order}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm text-foreground",
                        dateOrder === order ? "border-primary bg-accent/40" : "border-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-date-order"
                        value={order}
                        checked={dateOrder === order}
                        onChange={() => setDateOrder(order)}
                        className="size-4"
                      />
                      {t(`dateOrder.${order}`, {
                        date: read ? formatDateOnly(locale, read) : sampleDate,
                      })}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {attention.size > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("needsYou")}</h3>
              <ColumnHeads />
              <ul className="flex flex-col divide-y divide-border rounded-surface border border-border bg-card">
                {answered
                  .filter((a) => attention.has(a.column.col))
                  .map((a) => (
                    <MappingRow
                      key={a.column.col}
                      {...rowProps(a)}
                      warning={
                        a.value === "skip"
                          ? {
                              text:
                                vaccineFromHeading(a.column.heading) !== null
                                  ? t("skippedVaccine")
                                  : t("skippedDates"),
                              action: a.column.admitted.includes("vaccine.column")
                                ? {
                                    label: t("takeAsVaccine", {
                                      name: vaccineNameOf(a.column.col, a.column.heading),
                                    }),
                                    run: () =>
                                      setFields((p) => ({ ...p, [a.column.col]: "vaccine.column" })),
                                  }
                                : undefined,
                            }
                          : undefined
                      }
                    />
                  ))}
              </ul>
            </div>
          )}

          {matchedCount > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span
                  className="inline-block text-muted-foreground transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >
                  ›
                </span>
                {t("matchedSummary", { count: matchedCount })}
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <ColumnHeads />
                <ul className="flex flex-col divide-y divide-border rounded-surface border border-border bg-card">
                  {answered
                    .filter((a) => !attention.has(a.column.col))
                    .map((a) => (
                      <MappingRow key={a.column.col} {...rowProps(a)} />
                    ))}
                </ul>
              </div>
            </details>
          )}

          <div className="flex flex-col gap-3">
            {showProblems && blocking && (
              <div ref={problemRef} tabIndex={-1} className="flex flex-col gap-2 outline-none">
                {open.length > 0 && (
                  <Callout variant="warning">{t("openLeft", { count: open.length })}</Callout>
                )}
                {dateOpen && <Callout variant="warning">{t("dateUnanswered")}</Callout>}
                {!hasOwner && <Callout variant="warning">{t("missingOwner")}</Callout>}
                {hasOwner && !hasPet && <Callout variant="warning">{t("missingPet")}</Callout>}
              </div>
            )}
            <Button type="button" className="self-start" onClick={onContinue}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function ColumnHeads() {
  const t = useTranslations("import");
  return (
    <div
      className="hidden px-4 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:gap-x-6"
      aria-hidden="true"
    >
      <span>{t("colFile")}</span>
      <span className="ps-4">{t("colField")}</span>
    </div>
  );
}

/**
 * Rows above the table that are its title: "MÜŞTERİ LİSTESİ - Elif" and the
 * blank line under it. A row with at most one filled cell, above the first
 * row that fills two or more, in a sheet at least three columns wide. Read
 * as data, the title becomes a client called "MÜŞTERİ LİSTESİ - Elif" and
 * the real headings become a record.
 */
export function leadingTitleRows(sheet: SheetTable): number {
  if (sheet.columnCount < 3) return 0;
  for (let i = 0; i < sheet.rows.length; i += 1) {
    const filled = sheet.rows[i].filter((c) => c.text.trim() !== "").length;
    if (filled >= 2) return i;
  }
  return 0;
}
