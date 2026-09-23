"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ColumnCard } from "@/components/import/column-card";
import { ImportCommit } from "@/components/import/import-commit";
import { classifyColumn, type ColumnEvidence } from "@/modules/import/infer";
import { propose, type ImportField, type Proposal } from "@/modules/import/fields";
import { MAX_IMPORT_BYTES, MAX_IMPORT_MB } from "@/modules/import/limits";
import type { Cell, SheetTable } from "@/modules/import/read-workbook";
import { headerEvidence } from "@/modules/import/read-workbook";

/**
 * The mapping screen: four questions, in the order the file forces.
 *
 * WHY THE WHOLE TABLE COMES TO THE BROWSER. The header question decides what
 * counts as a body row, and the column evidence has to be read from body rows
 * only -- run it first and the heading "Tel" is one of the values being
 * classified, which is exactly the contamination `read-workbook` refuses to
 * commit on the vet's behalf. Re-asking a server after each answer would put
 * a network round trip between a radio button and the cards under it; the
 * inference is pure and small (`infer.ts` imports nothing), so it runs here.
 *
 * WHAT THAT COSTS, since it is the scale question this screen has: the rows
 * cross the wire once as JSON and sit in browser state once. Measured on the
 * `five-hundred-rows` fixture (`e2e/import-fixtures.ts`), 501 rows by 8
 * columns is 136.6 KB of JSON -- so a file several times that size is still
 * an ordinary page, and one card per column is what actually grows: thirty
 * columns is thirty cards, which the grid handles and a `<table>` would not
 * at 390px. If a real file ever makes those numbers uncomfortable, the fix
 * is to send the answers back and classify on the server, not to trim what
 * the vet is shown.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "failed"; reason: "tooLarge" | "unreadable" | "noFile" | "unexpected" }
  | { kind: "read"; sheets: SheetTable[] };

/** What the vet said about the first row. `null` until they say. */
type HeaderAnswer = "names" | "record" | null;

// The limit is imported rather than passed down. It is a constant, not a
// fact about this render, and handing a server component's `CONST` across
// the boundary as a prop is indistinguishable -- to a reader and to
// `app/client-boundary.test.ts` -- from handing over a component.
export function ImportMapper() {
  const t = useTranslations("import");
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [sheetIndex, setSheetIndex] = React.useState(0);
  const [headerAnswer, setHeaderAnswer] = React.useState<HeaderAnswer>(null);
  const [fields, setFields] = React.useState<Record<number, ImportField | "">>({});
  const [dateOrders, setDateOrders] = React.useState<
    Record<number, "dayFirst" | "monthFirst">
  >({});
  const [showUnanswered, setShowUnanswered] = React.useState(false);
  // Kept only to say it back: the saving step records the vet's own file
  // name on the batch, so the list of imports they can undo reads
  // "musteriler-2024.xlsx" rather than a time.
  const [fileName, setFileName] = React.useState("");

  async function onFile(file: File) {
    setFileName(file.name);
    setSheetIndex(0);
    setHeaderAnswer(null);
    setFields({});
    setDateOrders({});
    setShowUnanswered(false);

    // Checked here so the vet gets a sentence rather than a request that
    // dies on the way out. The endpoint checks the same number again.
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({ kind: "failed", reason: "tooLarge" });
      return;
    }

    setPhase({ kind: "reading" });
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body });
      if (!res.ok) {
        const reason =
          res.status === 413
            ? "tooLarge"
            : res.status === 422
              ? "unreadable"
              : res.status === 400
                ? "noFile"
                : "unexpected";
        setPhase({ kind: "failed", reason });
        return;
      }
      const data = (await res.json()) as { sheets: SheetTable[] };
      setPhase({ kind: "read", sheets: data.sheets });
    } catch {
      setPhase({ kind: "failed", reason: "unexpected" });
    }
  }

  const sheets = phase.kind === "read" ? phase.sheets : [];
  const sheet: SheetTable | undefined = sheets[sheetIndex];
  const evidence = React.useMemo(() => headerEvidence(sheet?.rows ?? []), [sheet]);

  // The first row is a heading only once the vet says so. Everything below
  // reads from `bodyRows`, which is the whole point of asking first.
  const bodyRows: Cell[][] = React.useMemo(() => {
    if (!sheet) return [];
    return headerAnswer === "names" ? sheet.rows.slice(1) : sheet.rows;
  }, [sheet, headerAnswer]);

  const columns = React.useMemo(() => {
    if (!sheet || headerAnswer === null) return [];
    const headings = headerAnswer === "names" ? (sheet.rows[0] ?? []) : [];
    return Array.from({ length: sheet.columnCount }, (_, col) => {
      const values = bodyRows.map((row) => row[col]?.text ?? "");
      // Text only, and that is not a loss: `read-workbook` writes a real
      // Excel date out as ISO, which `infer.ts` reads as `iso` and calls
      // decidable. A genuine date never becomes a question here, and a
      // date-SHAPED string still does -- which is the split both modules
      // were built around. (Checked rather than assumed: `toCell` and
      // `dateOrder`.)
      const columnEvidence: ColumnEvidence = classifyColumn(values);
      const heading = headings[col]?.text;
      const proposal: Proposal = propose(columnEvidence, heading);
      return { col, heading, evidence: columnEvidence, proposal };
    });
  }, [sheet, headerAnswer, bodyRows]);

  // A settled column arrives with its answer; an unsettled one arrives with
  // none, and stays that way until the vet gives one. The two used to look
  // the same on screen, which made the second an answer nobody gave.
  // Memoised because the saving step's mapping is built from it: without a
  // stable identity that list would be rebuilt on every keystroke anywhere
  // on the page, and the rule itself would have to be written twice.
  const chosen = React.useCallback(
    (col: number, proposal: Proposal): ImportField | "" =>
      fields[col] ?? (proposal.settled ? (proposal.candidates[0] ?? "skip") : ""),
    [fields],
  );

  const openDateQuestions = columns.filter(
    (c) => c.evidence.dateOrder === "ambiguous" && !dateOrders[c.col],
  ).length;
  const unanswered = columns.filter((c) => chosen(c.col, c.proposal) === "").length;
  const skipped = columns.filter((c) => chosen(c.col, c.proposal) === "skip").length;
  const mapped = columns.length - unanswered - skipped;

  // The answers as the saving step needs them: one field per column, and
  // only the columns that have an answer. An unanswered column is absent
  // rather than `skip`, because those are different things and the saving
  // step refuses to run while any are open.
  const chosenMapping = React.useMemo(() => {
    const out: Record<number, ImportField> = {};
    for (const column of columns) {
      const field = chosen(column.col, column.proposal);
      if (field !== "") out[column.col] = field;
    }
    return out;
  }, [columns, chosen]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("fileTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <label
            htmlFor="import-file"
            className="text-sm font-medium text-foreground"
          >
            {t("chooseFile")}
          </label>
          <input
            id="import-file"
            type="file"
            accept=".xlsx"
            className="text-sm text-foreground file:me-3 file:rounded-control file:border file:border-input file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <p className="text-sm text-muted-foreground">
            {t("fileHint", { mb: MAX_IMPORT_MB })}
          </p>
          {phase.kind === "reading" && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("reading")}
            </p>
          )}
          {phase.kind === "failed" && (
            <Callout variant="danger">
              {phase.reason === "tooLarge"
                ? t("failedTooLarge", { mb: MAX_IMPORT_MB })
                : phase.reason === "unreadable"
                  ? t("failedUnreadable")
                  : phase.reason === "noFile"
                    ? t("failedNoFile")
                    : t("failedUnexpected")}
            </Callout>
          )}
        </CardContent>
      </Card>

      {phase.kind === "read" && sheets.length === 0 && (
        <EmptyState icon={Upload} title={t("emptyBook")} description={t("emptyBookHint")} />
      )}

      {/* Asked only when there is something to ask: one sheet is not a
          question, and a screen that asks one is padding itself out. */}
      {sheets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sheetTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <label htmlFor="import-sheet" className="text-sm text-muted-foreground">
              {t("sheetQuestion")}
            </label>
            <Select
              id="import-sheet"
              value={String(sheetIndex)}
              onChange={(e) => {
                setSheetIndex(Number(e.target.value));
                setHeaderAnswer(null);
                setFields({});
                setDateOrders({});
              }}
            >
              {sheets.map((s, i) => (
                <option key={s.name} value={i}>
                  {t("sheetOption", { name: s.name, rows: s.rows.length })}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      {sheet && sheet.rows.length === 0 && (
        <EmptyState icon={Upload} title={t("emptySheet")} description={t("emptySheetHint")} />
      )}

      {sheet && sheet.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("headerTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* The row itself, while the question about it is open. Asking
                somebody to classify a row they cannot see is asking them to
                guess -- and once they have answered, every one of these
                cells is on a card of its own, either as a heading or as a
                value. Leaving it here would be the same sentence twice on
                one screen, which is the fault /reminders was just fixed
                for. `overflow-x-auto` rather than wrapping: a thirty-column
                sheet is a row, and a wrapped row stops looking like one. */}
            {headerAnswer === null && (
            <div className="overflow-x-auto">
              <ul className="flex w-max gap-2">
                {(sheet.rows[0] ?? []).map((cell, i) => (
                  <li
                    key={i}
                    className="max-w-40 truncate rounded-control border border-border px-2 py-1 text-sm text-foreground"
                    title={cell.text}
                  >
                    {cell.text.trim() === "" ? t("cellEmpty") : cell.text}
                  </li>
                ))}
              </ul>
            </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">
                {t("headerQuestion")}
              </legend>
              {(["names", "record"] as const).map((answer) => (
                <label key={answer} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="import-header"
                    value={answer}
                    checked={headerAnswer === answer}
                    onChange={() => setHeaderAnswer(answer)}
                    className="size-4"
                  />
                  {t(`headerOption.${answer}`)}
                </label>
              ))}
            </fieldset>

            {/* What the file suggests, and where it cannot suggest anything.
                `comparable: 0` is a sheet of free text: nothing in it can
                tell a heading from a record, and the product says that
                instead of choosing for the vet. */}
            <Callout variant="info">
              {evidence.comparable === 0
                ? t("headerCannotTell")
                : evidence.looksLikeHeader
                  ? t("headerLooksLikeNames", { count: evidence.comparable })
                  : t("headerLooksLikeRecord")}
            </Callout>

            {showUnanswered && headerAnswer === null && (
              <Callout variant="warning">{t("headerUnanswered")}</Callout>
            )}
          </CardContent>
        </Card>
      )}

      {sheet && sheet.rows.length > 0 && headerAnswer === null && (
        <button
          type="button"
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => setShowUnanswered(true)}
        >
          {t("continue")}
        </button>
      )}

      {columns.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {t("columnsTitle", { count: columns.length })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column) => (
              <ColumnCard
                key={column.col}
                index={column.col}
                heading={column.heading}
                evidence={column.evidence}
                proposal={column.proposal}
                value={chosen(column.col, column.proposal)}
                onChange={(field) =>
                  setFields((prev) => ({ ...prev, [column.col]: field }))
                }
                dateOrder={dateOrders[column.col]}
                onDateOrder={(order) =>
                  setDateOrders((prev) => ({ ...prev, [column.col]: order }))
                }
                showUnanswered={showUnanswered}
              />
            ))}
          </div>
        </section>
      )}

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              {t("summaryRows", { rows: bodyRows.length })}
            </p>
            {/* Future tense, and the reason is a misreading pm measured:
                "2 columns go to a field" is the language of finished work,
                so a vet who then opens an empty client list concludes the
                product is broken rather than unfinished. */}
            <p className="text-sm text-foreground">
              {t("summaryFields", { mapped, skipped })}
            </p>
            {unanswered > 0 && (
              <Callout variant="warning">
                {t("summaryUnanswered", { count: unanswered })}
              </Callout>
            )}
            {openDateQuestions > 0 && (
              <Callout variant="warning">
                {t("summaryOpenDates", { count: openDateQuestions })}
              </Callout>
            )}
          </CardContent>
        </Card>
      )}

      {/* The saving step, and the sentence that used to stand in its place
          is gone: "nothing is created in this step" was true for exactly as
          long as there was no step. The screen carries the rows across
          rather than re-uploading the file -- the browser read them out of
          a file the browser chose, and the server rebuilds the plan from
          them against the clinic's own clients, which is the half that
          cannot be done here. */}
      {columns.length > 0 && sheet && (
        <ImportCommit
          rows={bodyRowsForCommit(sheet, headerAnswer)}
          fileName={fileName}
          sheetIndex={sheetIndex}
          headerRow={headerAnswer === "names"}
          mapping={chosenMapping}
          dateOrders={dateOrders}
          blocked={unanswered > 0 || openDateQuestions > 0}
          // The saving step refuses and hands the reason back up here: the
          // unanswered cards say so themselves, which is where the vet can
          // actually do something about it.
          onBlocked={() => setShowUnanswered(true)}
        />
      )}
    </div>
  );
}

/**
 * The sheet as plain text, with the heading row still on it when there is
 * one. The header answer travels beside the rows rather than being applied
 * here, so the server reads the file the same way the screen did and the
 * row numbers in its plan are the row numbers the vet answered about.
 */
function bodyRowsForCommit(sheet: SheetTable, headerAnswer: HeaderAnswer): string[][] {
  if (headerAnswer === null) return [];
  return sheet.rows.map((row) => row.map((cell) => cell.text));
}
