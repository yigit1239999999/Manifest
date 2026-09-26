"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SPECIES } from "@/modules/pets/schema";
import type { ImportField } from "@/modules/import/fields";
import type { DuplicateAnswer } from "@/modules/import/plan";
import type { SpeciesTarget } from "@/modules/import/enum-map";
import type { CommitResult, PlanSummary, UndoResult } from "@/modules/import/service";
import type { Sex, Species } from "@/generated/prisma/enums";

/**
 * From the answered columns to rows in the database, with the plan in
 * between.
 *
 * WHY THERE IS A STEP HERE AT ALL. The mapping screen asks what each column
 * is; it cannot ask the questions that only appear once the file is read as
 * people and animals -- which rows are one client, what "Tekir Kedi" means,
 * what "K" means. Those answers change hundreds of records at once, and the
 * one place a vet can judge them is a screen that shows the counts BEFORE
 * anything happens. So: plan, read it, answer what is open, then save.
 *
 * THE PLAN IS RE-ASKED WHENEVER A "SAME PERSON?" ANSWER CHANGES, because
 * that answer changes the numbers on the screen. The species and sex tables
 * do not: they decide what each animal is, not how many there are, so
 * changing one of those is local and costs no request.
 *
 * WHAT THIS SCREEN NEVER DOES: decide. Every table here arrives filled in
 * and every line of it is a control the vet can change, including the ones
 * the product is sure about. "Erkek" becoming MALE is correct and is still
 * shown, because the vet has to be able to see the whole translation before
 * two thousand animals are written with it.
 */

type Phase =
  | { kind: "idle" }
  /** Re-planning keeps the previous plan on screen; see `answerDuplicate`. */
  | { kind: "planning"; summary: PlanSummary | null }
  | { kind: "planned"; summary: PlanSummary }
  | { kind: "planFailed" }
  | { kind: "saving"; summary: PlanSummary }
  | { kind: "saveFailed"; summary: PlanSummary }
  | { kind: "saved"; result: CommitResult };

type SpeciesAnswer = { target: SpeciesTarget; breed?: string };

export function ImportCommit({
  rows,
  fileName,
  sheetIndex,
  headerRow,
  mapping,
  dateOrders,
  blocked,
  onBlocked,
}: {
  /** The chosen sheet's rows, as text, exactly as the workbook had them. */
  rows: string[][];
  fileName: string;
  sheetIndex: number;
  headerRow: boolean;
  mapping: Record<number, ImportField>;
  dateOrders: Record<number, "dayFirst" | "monthFirst">;
  /** True while the mapping screen still has a question of its own open. */
  blocked: boolean;
  /**
   * Called when the vet asks for something this step cannot do yet, so the
   * mapping screen can show ITS unanswered questions. The button says no and
   * points at the reason in one press; see the note on the buttons below.
   */
  onBlocked: () => void;
}) {
  const t = useTranslations("import");
  const tSpecies = useTranslations("enum.species");
  const tSex = useTranslations("enum.sex");

  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [duplicates, setDuplicates] = React.useState<Record<string, DuplicateAnswer>>({});
  const [species, setSpecies] = React.useState<Record<string, SpeciesAnswer>>({});
  const [sex, setSex] = React.useState<Record<string, Sex>>({});
  const [undone, setUndone] = React.useState<UndoResult | null>(null);
  const [undoFailed, setUndoFailed] = React.useState(false);
  const [undoing, startUndo] = React.useTransition();
  /**
   * Why no button here is ever disabled.
   *
   * A disabled button does not say why it is disabled, and this screen has
   * two different reasons -- an unanswered column up on the mapping screen,
   * and an unanswered "same person?" down here. The house rule (the
   * "Continue" button one card up does the same thing) is: the button is
   * always pressable, and pressing it either does the work or SHOWS WHAT IS
   * IN THE WAY. These two flags are what turns the press into the answer.
   */
  const [askedWhileBlocked, setAskedWhileBlocked] = React.useState(false);
  const [askedWithQuestions, setAskedWithQuestions] = React.useState(false);

  const answers = React.useMemo(
    () => ({ fileName, sheetIndex, headerRow, mapping, dateOrders }),
    [fileName, sheetIndex, headerRow, mapping, dateOrders],
  );

  const post = React.useCallback(
    async (path: string, duplicateAnswers: Record<string, DuplicateAnswer>) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows,
          answers: { ...answers, duplicates: duplicateAnswers, species, sex },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    [rows, answers, species, sex],
  );

  const plan = React.useCallback(
    async (duplicateAnswers: Record<string, DuplicateAnswer>) => {
      setPhase((previous) => ({
        kind: "planning",
        summary: "summary" in previous ? previous.summary : null,
      }));
      try {
        const data = (await post("/api/import/plan", duplicateAnswers)) as {
          summary: PlanSummary;
        };
        setPhase({ kind: "planned", summary: data.summary });
      } catch {
        setPhase({ kind: "planFailed" });
      }
    },
    [post],
  );

  function answerDuplicate(key: string, answer: DuplicateAnswer) {
    const next = { ...duplicates, [key]: answer };
    setDuplicates(next);
    // The counts on screen are about to be wrong, so they are re-asked
    // rather than left to be read as if they still held.
    void plan(next);
  }

  function requestPlan() {
    if (blocked) {
      setAskedWhileBlocked(true);
      onBlocked();
      return;
    }
    void plan(duplicates);
  }

  function requestSave(summary: PlanSummary) {
    if (blocked) {
      setAskedWhileBlocked(true);
      onBlocked();
      return;
    }
    if (summary.questions.some((q) => !duplicates[q.key])) {
      setAskedWithQuestions(true);
      return;
    }
    void save(summary);
  }

  async function save(summary: PlanSummary) {
    setPhase({ kind: "saving", summary });
    try {
      const data = (await post("/api/import/commit", duplicates)) as { result: CommitResult };
      setPhase({ kind: "saved", result: data.result });
    } catch {
      setPhase({ kind: "saveFailed", summary });
    }
  }

  function undo(batchId: string) {
    setUndoFailed(false);
    startUndo(async () => {
      try {
        const res = await fetch("/api/import/undo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchId }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { result: UndoResult };
        // Counted rather than reloaded: how many rows STAYED is the part
        // the vet needs, and a reload would replace that sentence with a
        // list that no longer mentions the rows it is about.
        setUndone(data.result);
      } catch {
        setUndoFailed(true);
      }
    });
  }

  if (phase.kind === "saved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("resultTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-foreground">
            {t("resultCounts", {
              clients: phase.result.clientCount,
              pets: phase.result.petCount,
            })}
          </p>
          {phase.result.mergedCount > 0 && (
            <p className="text-sm text-foreground">
              {t("resultMerged", { count: phase.result.mergedCount })}
            </p>
          )}
          <Link
            href="/clients"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("resultGoToClients")}
          </Link>
          {undone ? (
            <Callout variant="info">
              {t("undoDone", { clients: undone.clientCount, pets: undone.petCount })}
              {undone.keptClients + undone.keptPets > 0
                ? ` ${t("undoKept", { clients: undone.keptClients, pets: undone.keptPets })}`
                : ""}
            </Callout>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={undoing}
              onClick={() => undo(phase.result.batchId)}
            >
              {undoing ? t("undoing") : t("undoButton")}
            </Button>
          )}
          {undoFailed && <Callout variant="danger">{t("undoFailed")}</Callout>}
        </CardContent>
      </Card>
    );
  }

  // The previous plan stays up while a new one is being worked out. It used
  // to be cleared, which took the radio the vet had just clicked off the
  // screen and put it back a moment later with the answer in it.
  const summary =
    phase.kind === "planned" ||
    phase.kind === "saving" ||
    phase.kind === "saveFailed" ||
    phase.kind === "planning"
      ? phase.summary
      : null;
  const openQuestions = summary
    ? summary.questions.filter((q) => !duplicates[q.key]).length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commitTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {askedWhileBlocked && blocked && (
          <Callout variant="warning">{t("commitBlockedMapping")}</Callout>
        )}

        {phase.kind !== "planning" && !summary && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={requestPlan}
          >
            {t("planButton")}
          </Button>
        )}
        {phase.kind === "planning" && (
          <p className="text-sm text-muted-foreground" role="status">
            {t("planning")}
          </p>
        )}
        {phase.kind === "planFailed" && <Callout variant="danger">{t("planFailed")}</Callout>}

        {summary && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-foreground">
                {t("planCreate", { count: summary.createCount })}
              </p>
              {summary.mergeCount > 0 && (
                <p className="text-sm text-foreground">
                  {t("planMerge", { count: summary.mergeCount })}
                </p>
              )}
              <p className="text-sm text-foreground">
                {t("planPets", { count: summary.petCount })}
              </p>
              {summary.blankRows > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("planBlank", { count: summary.blankRows })}
                </p>
              )}
              {summary.noOwnerRows > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("planNoOwner", { count: summary.noOwnerRows })}
                </p>
              )}
              {summary.clientOnlyRows > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("planClientOnly", { count: summary.clientOnlyRows })}
                </p>
              )}
            </div>

            {summary.questions.length > 0 && (
              <section className="flex flex-col gap-3">
                {/* The screen's only unanswered question, and it used to
                    carry its smallest heading -- lighter than "File", a
                    step that is already finished (pm). An engine that shows
                    where the obstacle is, in the lightest type on the page,
                    has given direction without weight. `h4` because it sits
                    under this card's own title; 16px because nothing else
                    on the screen is still waiting for the vet. */}
                <h4 className="text-base font-semibold text-foreground">
                  {t("questionsTitle")}
                </h4>
                <p className="text-sm text-muted-foreground">{t("questionsHint")}</p>
                {summary.questions.map((question) => (
                  <fieldset
                    key={question.key}
                    // `min-w-0`, and `break-words` alone was not enough:
                    // a fieldset's automatic minimum width is its own
                    // content (`components/ui/consent-choice.tsx:96` names
                    // the same thing), so with the owner's name in the
                    // legend the box stood 80px past the right edge of a
                    // 390px screen even after every line inside it was
                    // allowed to break. Measured both ways.
                    className="flex min-w-0 flex-col gap-2 rounded-control border border-border p-3"
                  >
                    {/* `break-words` here and on the choices below for the
                        same measured reason the column card has it: every one
                        of these lines prints a name out of the vet's file, and
                        a file that writes owners as `Ayse_Yilmaz_Kucukkaya`
                        has no break opportunity in it. Measured at 390px on
                        the column card, where the same class of string pushed
                        the field select 85px off the right edge.

                        `max-w-full` on the legend as well, and it is the
                        third measurement of the same box: a legend is laid
                        out by the engine rather than by its parent
                        (`components/forms/new-pet-block.tsx` says the same
                        thing about the same element), so it sized itself to
                        the owner's name and still stood 56px out inside a
                        fieldset that had stopped growing. 80px -> 56px ->
                        0px of sideways scroll at 390px, each step measured. */}
                    <legend className="max-w-full break-words px-1 text-sm font-medium text-foreground">
                      {question.name} ({t("questionRows", { rows: question.rows.join(", ") })})
                    </legend>
                    {question.candidates.map((candidate) => {
                      const value =
                        candidate.kind === "existing"
                          ? `existing:${candidate.id}`
                          : `group:${candidate.key}`;
                      return (
                        <label
                          key={value}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <input
                            type="radio"
                            name={`dup-${question.key}`}
                            // `shrink-0` and `mt-0.5`: once the sentence
                            // beside it is allowed to wrap onto a second
                            // line, `items-center` would float the radio
                            // halfway down the block, so the row is aligned
                            // to the top and the control sits on the first
                            // line of text -- the same shape `Callout` uses
                            // for its icon.
                            className="mt-0.5 size-4 shrink-0"
                            checked={answerValue(duplicates[question.key]) === value}
                            onChange={() =>
                              answerDuplicate(
                                question.key,
                                candidate.kind === "existing"
                                  ? { kind: "existing", id: candidate.id }
                                  : { kind: "group", key: candidate.key },
                              )
                            }
                          />
                          {/* `min-w-0` around the sentence, not on the label:
                              a flex item refuses to go narrower than its own
                              longest word while its `min-width` is `auto`,
                              and the word here is an owner's name out of the
                              file. Same pairing as `Callout`. */}
                          <span className="min-w-0 break-words">
                            {candidate.kind === "existing"
                              ? t("questionSameAsRegistered", {
                                  name: `${candidate.name} (${candidate.phone ?? t("questionNoPhone")})`,
                                })
                              : t("questionSameAs", {
                                  name: `${candidate.name} (${candidate.phone ?? t("questionNoPhone")})`,
                                })}
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
                        onChange={() => answerDuplicate(question.key, { kind: "separate" })}
                      />
                      {t("questionSeparate")}
                    </label>
                  </fieldset>
                ))}
              </section>
            )}

            {summary.species.length > 0 && (
              <section className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-foreground">{t("speciesTitle")}</h4>
                <p className="text-sm text-muted-foreground">{t("speciesHint")}</p>
                <ul className="flex flex-col gap-3">
                  {summary.species.map((proposal) => {
                    const answer = species[proposal.raw] ?? {
                      target: proposal.target,
                      breed: proposal.breed,
                    };
                    return (
                      <li key={proposal.raw} className="flex flex-col gap-1">
                        {/* `break-words`: `proposal.raw` is the word the file
                            used for the species, unedited. */}
                        <label
                          htmlFor={`species-${proposal.raw}`}
                          className="break-words text-sm text-foreground"
                        >
                          {proposal.raw}{" "}
                          <span className="text-muted-foreground">
                            ({t("speciesRows", { count: proposal.rows })})
                          </span>
                        </label>
                        <Select
                          id={`species-${proposal.raw}`}
                          value={targetValue(answer.target, proposal.raw)}
                          onChange={(e) =>
                            setSpecies((prev) => ({
                              ...prev,
                              [proposal.raw]: {
                                ...answer,
                                target: parseTarget(e.target.value, proposal.raw),
                              },
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
                        <label
                          htmlFor={`breed-${proposal.raw}`}
                          className="text-sm text-muted-foreground"
                        >
                          {t("speciesBreedLabel")}
                        </label>
                        <Input
                          id={`breed-${proposal.raw}`}
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
                {summary.speciesUnknownRows > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("speciesUnknownRows", { count: summary.speciesUnknownRows })}
                  </p>
                )}
              </section>
            )}

            {summary.sex.length > 0 && (
              <section className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-foreground">{t("sexTitle")}</h4>
                <p className="text-sm text-muted-foreground">{t("sexHint")}</p>
                <ul className="flex flex-col gap-3">
                  {summary.sex.map((proposal) => (
                    <li key={proposal.raw} className="flex flex-col gap-1">
                      {/* As above: the file's own word for the sex. */}
                      <label
                        htmlFor={`sex-${proposal.raw}`}
                        className="break-words text-sm text-foreground"
                      >
                        {proposal.raw}{" "}
                        <span className="text-muted-foreground">
                          ({t("sexRows", { count: proposal.rows })})
                        </span>
                      </label>
                      <Select
                        id={`sex-${proposal.raw}`}
                        value={sex[proposal.raw] ?? proposal.target ?? "UNKNOWN"}
                        onChange={(e) =>
                          setSex((prev) => ({ ...prev, [proposal.raw]: e.target.value as Sex }))
                        }
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

            {askedWithQuestions && openQuestions > 0 && (
              <Callout variant="warning">{t("commitBlocked")}</Callout>
            )}
            {phase.kind === "saveFailed" && (
              <Callout variant="danger">{t("commitFailed")}</Callout>
            )}
            <Button
              type="button"
              className="self-start"
              disabled={phase.kind === "saving"}
              onClick={() => requestSave(summary)}
            >
              {phase.kind === "saving" ? t("committing") : t("commitButton")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function answerValue(answer: DuplicateAnswer | undefined): string {
  if (!answer) return "";
  if (answer.kind === "existing") return `existing:${answer.id}`;
  if (answer.kind === "group") return `group:${answer.key}`;
  return "separate";
}

/** The species answer as one select value, in the pet form's own dialect. */
function targetValue(target: SpeciesTarget, raw: string): string {
  switch (target.kind) {
    case "builtIn":
      return `builtIn:${target.key}`;
    case "custom":
      return `custom:${target.id}`;
    case "newCustom":
      return `newCustom:${target.name}`;
    default:
      return `newCustom:${raw}`;
  }
}

function parseTarget(value: string, raw: string): SpeciesTarget {
  if (value.startsWith("builtIn:")) {
    return { kind: "builtIn", key: value.slice("builtIn:".length) as Species };
  }
  if (value.startsWith("custom:")) return { kind: "custom", id: value.slice("custom:".length) };
  if (value.startsWith("newCustom:")) {
    return { kind: "newCustom", name: value.slice("newCustom:".length) };
  }
  return { kind: "newCustom", name: raw };
}
