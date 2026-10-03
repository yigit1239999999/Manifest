"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CalendarClock, CircleAlert, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { SPECIES } from "@/modules/pets/schema";
import { MAX_REQUEST_MB } from "@/modules/import/limits";
import type { ImportField } from "@/modules/import/fields";
import type { DuplicateAnswer } from "@/modules/import/plan";
import type { SpeciesFallback, SpeciesTarget } from "@/modules/import/enum-map";
import type {
  CommitResult,
  PlanRowView,
  PlanSummary,
  UndoResult,
} from "@/modules/import/service";
import type { Sex, Species } from "@/generated/prisma/enums";
import { postImport, TooLargeError } from "@/components/import/transport";

/**
 * The check before anything is written, and the result after.
 *
 * WHAT THIS SCREEN IS FOR: the counts, the few things only the vet can
 * answer, and the rows that will not come in the way their columns said --
 * each with its reason, and where it can be, mended on the spot. A row that
 * waits for an answer is "waiting for you", never "left out": the second
 * is a verdict, and the vet has not given one.
 *
 * MENDING A ROW mends the CELL. The fix is written into the rows this
 * screen holds and the plan is asked again; the server reads the mended
 * file the same way it read the first, so a fix cannot become a second,
 * looser path into the database.
 *
 * THE RESULT IS THE POINT. "47 animals imported" is a count; "12
 * vaccinations are overdue, here they are" is the first thing the product
 * does for the clinic. The overdue numbers use the dashboard's own window,
 * so the result never promises rows the dashboard will not show.
 */
export type ReviewInput = {
  fileName: string;
  sheetIndex: number;
  headerRow: boolean;
  /** The table as text, the heading row still on it when there is one. */
  table: string[][];
  /** Original column index -> field. */
  mapping: Record<number, ImportField>;
  dateOrders: Record<number, "dayFirst" | "monthFirst">;
  vaccineNames: Record<number, string>;
  /** The sheet row number of body row 1, for "row 14" to mean Excel's 14. */
  firstRowNumber: number;
};

/**
 * How many "same person?" questions are drawn at once. The rest are
 * counted under them and answered by the one-tap button; a thousand
 * fieldsets is a page no browser scrolls and no person reads.
 */
const QUESTION_LIMIT = 30;

type SpeciesAnswer = { target: SpeciesTarget; breed?: string };

type Phase =
  | { kind: "planning"; summary: PlanSummary | null }
  | { kind: "planned"; summary: PlanSummary }
  | { kind: "planFailed"; tooLarge: boolean }
  | { kind: "saving"; summary: PlanSummary }
  | { kind: "saveFailed"; summary: PlanSummary; tooLarge: boolean }
  | { kind: "saved"; result: CommitResult; skipped: number };

export function ImportReview({ input, onBack }: { input: ReviewInput; onBack: () => void }) {
  const t = useTranslations("import");
  const tSpecies = useTranslations("enum.species");
  const tSex = useTranslations("enum.sex");

  const [phase, setPhase] = React.useState<Phase>({ kind: "planning", summary: null });
  const [duplicates, setDuplicates] = React.useState<Record<string, DuplicateAnswer>>({});
  const [species, setSpecies] = React.useState<Record<string, SpeciesAnswer>>({});
  const [sex, setSex] = React.useState<Record<string, Sex>>({});
  const [speciesFallback, setSpeciesFallback] = React.useState<SpeciesFallback | null>(null);
  const [nextDueFromList, setNextDueFromList] = React.useState<boolean | null>(null);
  const [patches, setPatches] = React.useState<Record<string, string>>({});
  const [excluded, setExcluded] = React.useState<Set<number>>(new Set());
  const [askedWithQuestions, setAskedWithQuestions] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // Only the columns being imported travel, renumbered 0..n. The server
  // never needed the others, and on a wide sheet they are most of the bytes.
  const used = React.useMemo(
    () =>
      Object.entries(input.mapping)
        .filter(([, field]) => field !== "skip")
        .map(([col]) => Number(col))
        .sort((a, b) => a - b),
    [input.mapping],
  );

  const body = React.useCallback(() => {
    const offset = input.headerRow ? 1 : 0;
    const rows = input.table.map((row, r) => {
      const bodyIndex = r - offset + 1;
      if (bodyIndex >= 1 && excluded.has(bodyIndex)) return used.map(() => "");
      return used.map((col) => patches[`${bodyIndex}:${col}`] ?? row[col] ?? "");
    });
    const remap = <T,>(source: Record<number, T>) => {
      const out: Record<number, T> = {};
      used.forEach((col, j) => {
        if (source[col] !== undefined) out[j] = source[col];
      });
      return out;
    };
    return {
      rows,
      answers: {
        fileName: input.fileName,
        sheetIndex: input.sheetIndex,
        headerRow: input.headerRow,
        mapping: remap(input.mapping),
        dateOrders: remap(input.dateOrders),
        vaccineNames: remap(input.vaccineNames),
        duplicates,
        species,
        sex,
        ...(speciesFallback ? { speciesFallback } : {}),
        ...(nextDueFromList ? { nextDueFromList: true } : {}),
      },
    };
  }, [input, used, patches, excluded, duplicates, species, sex, speciesFallback, nextDueFromList]);

  const plan = React.useCallback(async () => {
    setPhase((previous) => ({
      kind: "planning",
      summary: "summary" in previous ? previous.summary : null,
    }));
    try {
      const data = await postImport<{ summary: PlanSummary }>("/api/import/plan", body());
      setPhase({ kind: "planned", summary: data.summary });
    } catch (error) {
      setPhase({ kind: "planFailed", tooLarge: error instanceof TooLargeError });
    }
  }, [body]);

  // Asked again whenever an answer changes a count: who is the same
  // person, which rows are mended or left out, and the next-dose answer.
  // Species and sex change what an animal is, not how many there are.
  React.useEffect(() => {
    // Fetching the plan is the effect's job; the state it sets is the
    // answer arriving, not a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void plan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicates, patches, excluded, nextDueFromList, speciesFallback]);

  const saved = phase.kind === "saved";
  React.useEffect(() => {
    // The heading the vet lands on when the result replaces the check:
    // the button they pressed is gone, and focus must not fall to the body.
    if (saved) headingRef.current?.focus();
  }, [saved]);

  async function save(summary: PlanSummary) {
    if (summary.questions.some((q) => !duplicates[q.key])) {
      setAskedWithQuestions(true);
      return;
    }
    setPhase({ kind: "saving", summary });
    try {
      const data = await postImport<{ result: CommitResult }>("/api/import/commit", body());
      setPhase({
        kind: "saved",
        result: data.result,
        skipped: summary.noOwnerRows + excluded.size,
      });
      window.scrollTo({ top: 0 });
    } catch (error) {
      setPhase({ kind: "saveFailed", summary, tooLarge: error instanceof TooLargeError });
    }
  }

  if (phase.kind === "saved") {
    return <ImportResult result={phase.result} skipped={phase.skipped} headingRef={headingRef} />;
  }

  const summary =
    phase.kind === "planned" || phase.kind === "saving" || phase.kind === "saveFailed"
      ? phase.summary
      : phase.kind === "planning"
        ? phase.summary
        : null;
  const openQuestions = summary ? summary.questions.filter((q) => !duplicates[q.key]).length : 0;
  const nothingNew =
    summary && summary.petCount === 0 && summary.createCount === 0 && summary.vaccinationCount === 0;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </button>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold tracking-tight text-foreground outline-none"
        >
          {t("reviewTitle")}
        </h2>
        <p className="break-words text-sm text-muted-foreground">{input.fileName}</p>
      </div>

      {!summary && phase.kind === "planning" && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("planning")}
        </p>
      )}
      {phase.kind === "planFailed" && (
        <Callout variant="danger" className="flex-wrap">
          <span>{phase.tooLarge ? t("commitTooLarge", { mb: MAX_REQUEST_MB }) : t("planFailed")}</span>
          {!phase.tooLarge && (
            <button type="button" className="font-medium underline" onClick={() => void plan()}>
              {t("retry")}
            </button>
          )}
        </Callout>
      )}

      {summary && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <p className="text-sm text-muted-foreground">{t("fromRows", { rows: summary.rowCount })}</p>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label={t("statPets", { count: summary.petCount })} value={summary.petCount} />
                <Stat label={t("statClients", { count: summary.createCount })} value={summary.createCount} />
                {summary.mergeCount > 0 && (
                  <Stat label={t("statMerged", { count: summary.mergeCount })} value={summary.mergeCount} />
                )}
                <Stat
                  label={t("statVaccinations", { count: summary.vaccinationCount })}
                  value={summary.vaccinationCount}
                />
              </dl>
              {summary.vaccines.length > 0 && (
                <p className="flex flex-wrap gap-2 text-sm text-foreground">
                  {summary.vaccines.map((v) => (
                    <span key={v.name} className="rounded-pill bg-muted px-2.5 py-0.5">
                      {t("vaccineCount", { name: v.name, count: v.count })}
                    </span>
                  ))}
                </p>
              )}
              {summary.existingPetCount > 0 && (
                <Callout variant="info">
                  {t("existingPets", { count: summary.existingPetCount })}
                  {summary.existingVaccinationCount > 0
                    ? ` ${t("existingVaccinations", { count: summary.existingVaccinationCount })}`
                    : ""}
                </Callout>
              )}
              {nothingNew && <Callout variant="info">{t("nothingNew")}</Callout>}
            </CardContent>
          </Card>

          {summary.nextDue && (
            <section className="flex flex-col gap-3 rounded-surface border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">{t("nextDueTitle")}</h3>
              <p className="text-sm text-foreground">
                {t("nextDueQuestion", {
                  intervals: summary.nextDue.intervals
                    .map((i) => `${i.name} ${t(`interval.${i.unit}`, { count: i.value })}`)
                    .join(", "),
                })}
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("nextDueTitle")}>
                {([true, false] as const).map((choice) => (
                  <label
                    key={String(choice)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm text-foreground",
                      nextDueFromList === choice ? "border-primary bg-accent/40" : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="import-next-due"
                      checked={nextDueFromList === choice}
                      onChange={() => setNextDueFromList(choice)}
                      className="size-4"
                    />
                    {choice ? t("nextDueYes") : t("nextDueNo")}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {nextDueFromList
                  ? t("nextDueYesEffect", {
                      count: summary.nextDue.proposable,
                      overdue: summary.nextDue.ifApplied.overdue + summary.nextDue.ifApplied.overdueOlder,
                      soon: summary.nextDue.ifApplied.dueSoon,
                    })
                  : t("nextDueNoEffect")}
              </p>
            </section>
          )}

          {summary.questions.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">{t("questionsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("questionsHint")}</p>
              {/* One answer for all of them. A big file can carry dozens of
                  same-name pairs, and making the vet click each one is the
                  product handing its own question back one row at a time.
                  It answers "different people" -- the answer that never
                  merges anybody -- and every line stays changeable. */}
              {openQuestions > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    setDuplicates((prev) => {
                      const next = { ...prev };
                      for (const q of summary.questions) next[q.key] ??= { kind: "separate" };
                      return next;
                    })
                  }
                >
                  {t("questionsAllSeparate")} ({t("questionsCount", { count: openQuestions })})
                </Button>
              )}
              {summary.questions.slice(0, QUESTION_LIMIT).map((question) => (
                <fieldset
                  key={question.key}
                  className={cn(
                    "flex min-w-0 flex-col gap-2 rounded-control border bg-card p-3",
                    askedWithQuestions && !duplicates[question.key] ? "border-warning" : "border-border",
                  )}
                >
                  <legend className="max-w-full break-words px-1 text-sm font-medium text-foreground">
                    {question.name} (
                    {t("questionRows", {
                      rows: question.rows.map((r) => r + input.firstRowNumber - 1).join(", "),
                    })}
                    )
                  </legend>
                  {question.candidates.map((candidate) => {
                    const value =
                      candidate.kind === "existing" ? `existing:${candidate.id}` : `group:${candidate.key}`;
                    const label = `${candidate.name} (${candidate.phone ?? t("questionNoPhone")})`;
                    return (
                      <label key={value} className="flex items-start gap-2 text-sm text-foreground">
                        <input
                          type="radio"
                          name={`dup-${question.key}`}
                          className="mt-0.5 size-4 shrink-0"
                          checked={answerValue(duplicates[question.key]) === value}
                          onChange={() =>
                            setDuplicates((prev) => ({
                              ...prev,
                              [question.key]:
                                candidate.kind === "existing"
                                  ? { kind: "existing", id: candidate.id }
                                  : { kind: "group", key: candidate.key },
                            }))
                          }
                        />
                        <span className="min-w-0 break-words">
                          {candidate.kind === "existing"
                            ? t("questionSameAsRegistered", { name: label })
                            : t("questionSameAs", { name: label })}
                        </span>
                      </label>
                    );
                  })}
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name={`dup-${question.key}`}
                      className="size-4"
                      checked={answerValue(duplicates[question.key]) === "separate"}
                      onChange={() =>
                        setDuplicates((prev) => ({ ...prev, [question.key]: { kind: "separate" } }))
                      }
                    />
                    {t("questionSeparate")}
                  </label>
                </fieldset>
              ))}
            </section>
          )}

          {summary.questions.length > QUESTION_LIMIT && (
            <p className="-mt-3 text-sm text-muted-foreground">
              {t("questionsMore", { count: summary.questions.length - QUESTION_LIMIT })}
            </p>
          )}

          <RowsToLookAt
            summary={summary}
            input={input}
            used={used}
            excluded={excluded}
            onPatch={(row, col, value) => setPatches((p) => ({ ...p, [`${row}:${col}`]: value }))}
            onExclude={(row, out) =>
              setExcluded((prev) => {
                const next = new Set(prev);
                if (out) next.add(row);
                else next.delete(row);
                return next;
              })
            }
          />

          {(summary.species.length > 0 || summary.sex.length > 0 || summary.speciesUnknownRows > 0) && (
            <details
              className="group rounded-surface border border-border bg-card p-4"
              open={summary.speciesUnknownRows > 0 || summary.species.some((s) => !s.settled) || undefined}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
                {t("tablesTitle")}
              </summary>
              <div className="mt-4 flex flex-col gap-6">
                {summary.speciesUnknownRows > 0 && (
                  <section className="flex min-w-0 flex-col gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{t("speciesMissingTitle")}</h4>
                    <label htmlFor="species-fallback" className="text-sm text-muted-foreground">
                      {t("speciesMissingQuestion")}
                    </label>
                    <Select
                      id="species-fallback"
                      className="sm:max-w-xs"
                      value={speciesFallback ? targetValue(speciesFallback) : ""}
                      onChange={(e) => setSpeciesFallback(parseFallback(e.target.value))}
                    >
                      <option value="">{t("speciesMissingUnanswered")}</option>
                      {SPECIES.map((key) => (
                        <option key={key} value={`builtIn:${key}`}>
                          {tSpecies(key)}
                        </option>
                      ))}
                      {summary.customSpecies.map((custom) => (
                        <option key={custom.id} value={`custom:${custom.id}`}>
                          {custom.name}
                        </option>
                      ))}
                    </Select>
                    <p className="break-words text-sm text-muted-foreground">
                      {speciesFallback
                        ? t("speciesMissingAnswered", {
                            count: summary.speciesUnknownRows,
                            name: fallbackName(speciesFallback, summary.customSpecies, tSpecies),
                          })
                        : t("speciesUnknownRows", { count: summary.speciesUnknownRows })}
                    </p>
                  </section>
                )}

                {summary.species.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{t("speciesTitle")}</h4>
                    <p className="text-sm text-muted-foreground">{t("speciesHint")}</p>
                    <ul className="flex flex-col divide-y divide-border">
                      {summary.species.map((proposal, i) => {
                        const answer = species[proposal.raw] ?? {
                          target: proposal.target,
                          breed: proposal.breed,
                        };
                        return (
                          <li
                            key={proposal.raw}
                            className="grid min-w-0 gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,12rem)] sm:items-center"
                          >
                            <label htmlFor={`import-species-${i}`} className="break-words text-sm text-foreground">
                              {proposal.raw}{" "}
                              <span className="text-muted-foreground">
                                ({t("speciesRows", { count: proposal.rows })})
                              </span>
                            </label>
                            <Select
                              id={`import-species-${i}`}
                              value={targetValue(answer.target)}
                              onChange={(e) =>
                                setSpecies((prev) => ({
                                  ...prev,
                                  [proposal.raw]: { ...answer, target: parseTarget(e.target.value, proposal.raw) },
                                }))
                              }
                            >
                              {SPECIES.map((key) => (
                                <option key={key} value={`builtIn:${key}`}>
                                  {tSpecies(key)}
                                </option>
                              ))}
                              {summary.customSpecies.map((custom) => (
                                <option key={custom.id} value={`custom:${custom.id}`}>
                                  {custom.name}
                                </option>
                              ))}
                              <option value={`newCustom:${proposal.raw}`}>
                                {t("speciesAddToClinic", { name: proposal.raw })}
                              </option>
                            </Select>
                            <Input
                              id={`import-breed-${i}`}
                              aria-label={`${t("speciesBreedLabel")}: ${proposal.raw}`}
                              placeholder={t("speciesBreedLabel")}
                              value={answer.breed ?? ""}
                              onChange={(e) =>
                                setSpecies((prev) => ({
                                  ...prev,
                                  [proposal.raw]: {
                                    ...answer,
                                    breed: e.target.value === "" ? undefined : e.target.value,
                                  },
                                }))
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {summary.sex.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{t("sexTitle")}</h4>
                    <p className="text-sm text-muted-foreground">{t("sexHint")}</p>
                    <ul className="flex flex-col divide-y divide-border">
                      {summary.sex.map((proposal, i) => (
                        <li
                          key={proposal.raw}
                          className="grid min-w-0 gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center"
                        >
                          <label htmlFor={`import-sex-${i}`} className="break-words text-sm text-foreground">
                            {proposal.raw}{" "}
                            <span className="text-muted-foreground">({t("sexRows", { count: proposal.rows })})</span>
                          </label>
                          <Select
                            id={`import-sex-${i}`}
                            value={sex[proposal.raw] ?? proposal.target ?? "UNKNOWN"}
                            onChange={(e) => setSex((prev) => ({ ...prev, [proposal.raw]: e.target.value as Sex }))}
                          >
                            {(["MALE", "FEMALE", "UNKNOWN"] as const).map((key) => (
                              <option key={key} value={key}>
                                {tSex(key)}
                              </option>
                            ))}
                          </Select>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </details>
          )}

          {/* The bar that stays: what will happen, what is still waiting,
              and the one button. Sticky rather than at the foot of a long
              page, so the count the vet is agreeing to is in view when
              they agree to it. */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-surface sm:border">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="min-w-0 flex-1 text-sm text-foreground">
                <span className="font-medium">
                  {t("statPets", { count: summary.petCount })} · {t("statClients", { count: summary.createCount })} ·{" "}
                  {t("statVaccinations", { count: summary.vaccinationCount })}
                </span>
                {openQuestions > 0 && (
                  <span className="ms-2 text-warning">{t("barWaiting", { count: openQuestions })}</span>
                )}
              </p>
              {nothingNew ? (
                <Link href="/" className={buttonVariants({ variant: "primary" })}>
                  {t("resultGoDashboard")}
                </Link>
              ) : (
              <Button
                type="button"
                disabled={phase.kind === "saving" || phase.kind === "planning"}
                onClick={() => void save(summary)}
              >
                {phase.kind === "saving" ? t("committing") : t("commitButton", { count: summary.petCount })}
              </Button>
              )}
            </div>
            {askedWithQuestions && openQuestions > 0 && (
              <p className="mt-2 text-sm text-warning" role="alert">
                {t("commitBlocked")}
              </p>
            )}
            {phase.kind === "saveFailed" && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {phase.tooLarge ? t("commitTooLarge", { mb: MAX_REQUEST_MB }) : t("commitFailed")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  // The number is in the label too ("47 hayvan"); it is drawn twice on
  // purpose -- big for the eye, whole for a screen reader.
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="sr-only">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums text-foreground" aria-hidden="true">
        {value}
      </dd>
      <dd className="break-words text-sm text-muted-foreground" aria-hidden="true">
        {label.replace(String(value), "").trim()}
      </dd>
    </div>
  );
}

/**
 * The rows that will not come in exactly as their columns said, each with
 * its reason and -- where a column exists to type into -- a fix in place.
 */
function RowsToLookAt({
  summary,
  input,
  used,
  excluded,
  onPatch,
  onExclude,
}: {
  summary: PlanSummary;
  input: ReviewInput;
  used: number[];
  excluded: Set<number>;
  onPatch: (row: number, col: number, value: string) => void;
  onExclude: (row: number, out: boolean) => void;
}) {
  const t = useTranslations("import");
  const excludedRows: PlanRowView[] = [...excluded]
    .filter((i) => !summary.rows.some((r) => r.index === i))
    .map((index) => ({ index, status: "skip", warnings: [], owner: null, pet: null, fixes: [] }));
  const rows = [...summary.rows, ...excludedRows];

  const columns: Column<PlanRowView>[] = [
    {
      key: "row",
      header: t("rowCol"),
      stack: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">
            {t("rowNumber", { number: row.index + input.firstRowNumber - 1 })}
          </span>
          <span className="break-words font-medium text-foreground">
            {[row.owner, row.pet].filter(Boolean).join(" · ") || "·"}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("rowStatus"),
      stack: "end",
      cell: (row) => {
        const status = excluded.has(row.index) ? "excluded" : row.status;
        return <StatusBadge kind="importRow" status={status} label={t(`status.${status}`)} />;
      },
    },
    {
      key: "what",
      header: t("rowWhat"),
      stack: "meta",
      cellClassName: "min-w-0",
      cell: (row) => (
        <RowWhat
          row={row}
          isExcluded={excluded.has(row.index)}
          rowNumber={row.index + input.firstRowNumber - 1}
          used={used}
          onPatch={onPatch}
          onExclude={onExclude}
        />
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">{t("rowsTitle")}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("rowsAllGood")}</p>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(row) => String(row.index)}
          columns={columns}
          caption={t("rowsTitle")}
          narrow="stack"
        />
      )}
      {summary.rowsNotShown > 0 && (
        <p className="text-sm text-muted-foreground">{t("rowsMore", { count: summary.rowsNotShown })}</p>
      )}
    </section>
  );
}

function RowWhat({
  row,
  isExcluded,
  rowNumber,
  used,
  onPatch,
  onExclude,
}: {
  row: PlanRowView;
  isExcluded: boolean;
  rowNumber: number;
  used: number[];
  onPatch: (row: number, col: number, value: string) => void;
  onExclude: (row: number, out: boolean) => void;
}) {
  const t = useTranslations("import");
  const lines: string[] = [];
  if (isExcluded) lines.push(t("excludedWhat"));
  else {
    if (row.status === "decision") lines.push(t("decisionWhat"));
    if (row.status === "existing") lines.push(t("existingWhat"));
    if (row.issue === "noOwnerName" || row.issue === "noPetName") lines.push(t(`issue.${row.issue}`));
    for (const w of row.warnings) {
      // A real Excel date travels as ISO; it is shown the way Turkish Excel
      // showed it to the person who typed it.
      const raw = /^\d{4}-\d{2}-\d{2}$/.test(w.raw) ? w.raw.split("-").reverse().join(".") : w.raw;
      lines.push(t(`warning.${w.kind}`, { raw, vaccine: w.vaccine ?? "" }));
    }
  }
  const Icon = row.status === "skip" || isExcluded ? CircleAlert : row.status === "existing" ? History : CalendarClock;
  return (
    <div className="flex min-w-0 flex-col gap-2 py-1">
      {lines.map((line, i) => (
        <p
          key={i}
          className={cn(
            "flex min-w-0 items-start gap-1.5 break-words text-sm",
            row.status === "skip" || isExcluded ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {i === 0 && <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="min-w-0">{line}</span>
        </p>
      ))}
      {!isExcluded &&
        row.fixes.map((fix) => (
          <FixField
            key={`${fix.field}-${fix.col}`}
            label={t("fixLabel", { field: t(`field.${fix.field}` as never), row: rowNumber })}
            initial={fix.raw}
            onSave={(value) => onPatch(row.index, used[fix.col] ?? fix.col, value)}
          />
        ))}
      {(row.status === "skip" || row.status === "warning" || isExcluded) && row.issue !== "noOwnerName" && (
        <button
          type="button"
          className="w-fit text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => onExclude(row.index, !isExcluded)}
        >
          {isExcluded ? t("includeRow") : t("excludeRow")}
        </button>
      )}
    </div>
  );
}

function FixField({
  label,
  initial,
  onSave,
}: {
  label: string;
  initial: string;
  onSave: (value: string) => void;
}) {
  const t = useTranslations("import");
  const [value, setValue] = React.useState(initial);
  const id = React.useId();
  return (
    <form
      className="flex min-w-0 items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 min-w-0 flex-1" />
      <Button type="submit" variant="secondary" size="sm" disabled={value.trim() === initial.trim()}>
        {t("fixSave")}
      </Button>
    </form>
  );
}

/**
 * The value moment. What came in, and -- the part that is new -- what the
 * clinic can do with it today, in the dashboard's own numbers.
 */
function ImportResult({
  result,
  skipped,
  headingRef,
}: {
  result: CommitResult;
  skipped: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("import");
  const [undone, setUndone] = React.useState<UndoResult | null>(null);
  const [undoFailed, setUndoFailed] = React.useState(false);
  const [undoing, startUndo] = React.useTransition();

  function undo() {
    setUndoFailed(false);
    startUndo(async () => {
      try {
        const res = await fetch("/api/import/undo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchId: result.batchId }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { result: UndoResult };
        setUndone(data.result);
      } catch {
        setUndoFailed(true);
      }
    });
  }

  const due = result.due;
  const anyDue = due.overdue + due.overdueOlder + due.dueSoon > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-foreground outline-none"
        >
          {t("resultTitle")}
        </h2>
        <p className="text-base text-foreground">
          {t("resultHeadline", { pets: result.petCount, clients: result.clientCount })}
        </p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {result.vaccinationCount > 0 && <li>{t("resultVaccinations", { count: result.vaccinationCount })}</li>}
          {result.mergedCount > 0 && <li>{t("resultMerged", { count: result.mergedCount })}</li>}
          {result.existingPetCount > 0 && <li>{t("resultExisting", { count: result.existingPetCount })}</li>}
          {skipped > 0 && <li>{t("resultSkipped", { count: skipped })}</li>}
        </ul>
      </div>

      {result.vaccinationCount > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">{t("resultNowTitle")}</h3>
          {anyDue ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {due.overdue > 0 && (
                <ValueCard href="/" title={t("resultOverdue", { count: due.overdue })} hint={t("resultOverdueHint")} tone="attention" />
              )}
              {due.overdueOlder > 0 && (
                <ValueCard
                  href="/"
                  title={t("resultOverdueOlder", { count: due.overdueOlder })}
                  hint={t("resultOverdueOlderHint")}
                  tone="attention"
                />
              )}
              {due.dueSoon > 0 && (
                <ValueCard href="/" title={t("resultDueSoon", { count: due.dueSoon })} hint={t("resultDueSoonHint")} tone="neutral" />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("resultNoDue")}</p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          {t("resultGoDashboard")}
        </Link>
        <Link href="/pets" className={buttonVariants({ variant: "secondary" })}>
          {t("resultGoPets")}
        </Link>
        <Link href="/clients" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("resultGoClients")}
        </Link>
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
        {undone ? (
          <Callout variant="info">
            {t("undoDone", {
              clients: undone.clientCount,
              pets: undone.petCount,
              vaccinations: undone.vaccinationCount,
            })}
            {undone.keptClients + undone.keptPets > 0
              ? ` ${t("undoKept", { clients: undone.keptClients, pets: undone.keptPets })}`
              : ""}
          </Callout>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={undoing} onClick={undo}>
            {undoing ? t("undoing") : t("undoButton")}
          </Button>
        )}
        {undoFailed && <Callout variant="danger">{t("undoFailed")}</Callout>}
      </div>
    </div>
  );
}

function ValueCard({
  href,
  title,
  hint,
  tone,
}: {
  href: string;
  title: string;
  hint: string;
  tone: "attention" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-surface border bg-card p-4 transition-colors hover:border-primary/40",
        tone === "attention" ? "border-warning/40" : "border-border",
      )}
    >
      <span className={cn("text-base font-semibold", tone === "attention" ? "text-warning" : "text-foreground")}>
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </Link>
  );
}

function answerValue(answer: DuplicateAnswer | undefined): string {
  if (!answer) return "";
  if (answer.kind === "existing") return `existing:${answer.id}`;
  if (answer.kind === "group") return `group:${answer.key}`;
  return "separate";
}

/** The species answer as one select value, in the pet form's own dialect. */
function targetValue(target: SpeciesTarget): string {
  switch (target.kind) {
    case "builtIn":
      return `builtIn:${target.key}`;
    case "custom":
      return `custom:${target.id}`;
    case "newCustom":
      return `newCustom:${target.name}`;
    default:
      // `unknown` is written as "other", so the picker says so.
      return "builtIn:OTHER";
  }
}

function parseFallback(value: string): SpeciesFallback | null {
  if (value.startsWith("builtIn:")) return { kind: "builtIn", key: value.slice("builtIn:".length) as Species };
  if (value.startsWith("custom:")) return { kind: "custom", id: value.slice("custom:".length) };
  return null;
}

function fallbackName(
  fallback: SpeciesFallback,
  custom: ReadonlyArray<{ id: string; name: string }>,
  tSpecies: (key: string) => string,
): string {
  if (fallback.kind === "builtIn") return tSpecies(fallback.key);
  return custom.find((entry) => entry.id === fallback.id)?.name ?? "";
}

function parseTarget(value: string, raw: string): SpeciesTarget {
  if (value.startsWith("builtIn:")) return { kind: "builtIn", key: value.slice("builtIn:".length) as Species };
  if (value.startsWith("custom:")) return { kind: "custom", id: value.slice("custom:".length) };
  if (value.startsWith("newCustom:")) return { kind: "newCustom", name: value.slice("newCustom:".length) };
  return { kind: "newCustom", name: raw };
}
