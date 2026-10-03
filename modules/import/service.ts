import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { fold } from "@/lib/search";
import type { ActionContext } from "@/lib/action";
import type { Prisma } from "@/generated/prisma/client";
import type { Sex, Species } from "@/generated/prisma/enums";
import {
  applySpecies,
  proposeSex,
  proposeSpecies,
  type SexProposal,
  type SpeciesFallback,
  type SpeciesProposal,
  type SpeciesTarget,
} from "./enum-map";
import {
  buildPlan,
  openQuestions,
  type DateOrders,
  type DuplicateAnswer,
  type ImportPlan,
  type Mapping,
  type OwnerGroup,
  type PlanRow,
  type RowIssue,
  type RowWarning,
} from "./plan";
import { addInterval } from "@/lib/vaccination-interval";
import { clinicVaccineList, normalizeVaccineSettings, offerByName, type VaccineOffer } from "@/modules/vaccinations/catalogue";
import { OVERDUE_WINDOW_MONTHS, vaccinationIntervalSuggestions } from "@/modules/vaccinations/queries";

/**
 * Writing the file, and being able to take it back.
 *
 * Two things hold this file up, and both are about the minute AFTER the
 * button.
 *
 * ONE: EVERY ROW THIS RUN CREATES CARRIES THE BATCH, AND NOTHING ELSE DOES.
 * A client the import merged onto is not tagged, because undo deletes by
 * batch and a clinic's own records may never be reachable that way. The
 * column means "we made this", and the whole safety of undo is that
 * sentence staying true.
 *
 * TWO: UNDO TAKES BACK WHAT HAS NOT BEEN USED. An animal that has had a
 * visit since the import is not deleted -- work happened on it, and undo is
 * for regretting an import, not for erasing a morning. Those rows stay and
 * are counted back to the vet, rather than the whole undo refusing because
 * of one of them: a clinic that starts working immediately is the normal
 * case, not the exception.
 *
 * QUERY COUNT: the writes are `createMany` per table and the deletes are
 * `deleteMany` with relation filters, so both scale with the number of
 * TABLES rather than with the number of rows. Nothing in here runs a query
 * per row, and nothing may start to.
 */

/** What the vet answered on the screen, everything that is not the file. */
export type ImportAnswers = {
  fileName: string;
  sheetIndex: number;
  /** Whether the first row is headings. Decided on the screen, applied here. */
  headerRow: boolean;
  mapping: Mapping;
  dateOrders: DateOrders;
  /** One answer per "possibly the same person" question, keyed by group. */
  duplicates: Record<string, DuplicateAnswer>;
  /** The species table as the vet left it, keyed by the value in the file. */
  species: Record<string, { target: SpeciesTarget; breed?: string }>;
  /** The sex table as the vet left it, keyed by the value in the file. */
  sex: Record<string, Sex>;
  /**
   * One answer for every row with no species of its own (#42), or absent.
   *
   * Absent is the ordinary case and means the vet left the question alone:
   * those rows stay "other", which is what they were before this existed.
   */
  speciesFallback?: SpeciesFallback;
  /** Per `vaccine.column`, the vaccine its dates are doses of. */
  vaccineNames?: Record<string, string>;
  /**
   * The vet's answer to "the file has no next date -- work it out from
   * your clinic's list?". Absent or false is "leave it empty", which is
   * what the vaccination form does too until somebody taps the proposal:
   * a next date is a medical claim, and nobody makes it by default.
   */
  nextDueFromList?: boolean;
};

/** A row of the plan the vet should look at, for the preview table. */
export type PlanRowView = {
  /** 1-based over body rows, like everywhere else in the plan. */
  index: number;
  status: "skip" | "decision" | "warning" | "existing";
  issue?: RowIssue;
  warnings: RowWarning[];
  owner: string | null;
  pet: string | null;
  /**
   * Cells this row could be mended in, on the screen: the column and what
   * is in it now. Only where a column is mapped -- a field the file has no
   * column for has nothing to type into.
   */
  fixes: Array<{ field: string; col: number; raw: string }>;
};

/** How many of the imported vaccinations land where, against today. */
export type DueCounts = {
  /** Past due within the dashboard's window: what the overdue card shows. */
  overdue: number;
  /** Past due before that window, so not on the card. Said, not hidden. */
  overdueOlder: number;
  /** Due in the next thirty days. */
  dueSoon: number;
};

/** What the screen shows before anything is written. */
export type PlanSummary = {
  rowCount: number;
  /** People this run would create. */
  createCount: number;
  /** People it would attach animals to, because name and phone both agree. */
  mergeCount: number;
  petCount: number;
  /** Animals in the file the clinic already has, under the same owner. */
  existingPetCount: number;
  /** Rows that make nobody, by reason. */
  blankRows: number;
  noOwnerRows: number;
  clientOnlyRows: number;
  /** The open questions, with their candidates, in the order they appear. */
  questions: Array<{
    key: string;
    name: string;
    phone: string | null;
    rows: number[];
    candidates: NonNullable<OwnerGroup["possible"]>;
  }>;
  species: SpeciesProposal[];
  sex: SexProposal[];
  /**
   * The clinic's own species, so the picker beside a species line can offer
   * them. Sent with the plan rather than fetched separately: the plan
   * already read them to make the proposals, and a second round trip for a
   * list of a handful of names would be a request for nothing.
   */
  customSpecies: Array<{ id: string; name: string }>;
  /**
   * Rows whose species the file does not give -- no column mapped, or the
   * cell left blank (or written as one of the clinic's ways of writing
   * "nothing", the same reading `plan.ts` gives the cell).
   *
   * THIS IS THE SET THE BULK ANSWER IS ABOUT (#42), so the number the screen
   * shows and the rows `speciesFallback` lands on have to be the same set.
   * They are the same predicate: this counts rows whose `speciesRaw` is null,
   * and that is exactly when `applySpecies` reaches for the fallback.
   *
   * Unanswered, these are recorded as the "other" species.
   */
  speciesUnknownRows: number;
  /** Vaccination records this run would write, and of which vaccines. */
  vaccinationCount: number;
  vaccines: Array<{ name: string; count: number }>;
  /** Vaccinations already on record, found again in the file and not rewritten. */
  existingVaccinationCount: number;
  /**
   * The next-date question, present only when it has something to answer:
   * vaccinations with no next date in the file whose vaccine the clinic's
   * list has an interval for. The counts on both sides of the answer are
   * here so the screen can say what each answer does.
   */
  nextDue: {
    proposable: number;
    intervals: Array<{ name: string; unit: "week" | "month" | "year"; value: number }>;
    ifApplied: DueCounts;
  } | null;
  /** Under the answers as they stand. */
  due: DueCounts;
  /** Rows to look at, at most `ROW_VIEW_LIMIT`. */
  rows: PlanRowView[];
  /** How many more rows to look at there are than `rows` carries. */
  rowsNotShown: number;
};

/** How many rows the preview carries. The counts above cover every row. */
const ROW_VIEW_LIMIT = 300;

function bodyRows(rows: string[][], headerRow: boolean): string[][] {
  return headerRow ? rows.slice(1) : rows;
}

/** Every column the vet sent to one field, for the enum tables. */
function columnValues(rows: string[][], mapping: Mapping, field: string): string[] {
  const columns = Object.entries(mapping)
    .filter(([, f]) => f === field)
    .map(([col]) => Number(col));
  if (columns.length === 0) return [];
  return rows.flatMap((row) => columns.map((col) => row[col] ?? ""));
}

const DAY_MS = 86_400_000;
/** A day from the file, stored at noon UTC: the same day in every clinic zone. */
const NOON = 12 * 60 * 60 * 1000;

/** One vaccination as it will be written. */
type VaccinationItem = {
  rowIndex: number;
  /** A pet this clinic has, or the index of the row whose new pet it is. */
  existingPetId: string | null;
  name: string;
  administeredAt: Date;
  nextDueAt: Date | null;
  nextDueSource: "MANUAL" | "HISTORY" | "CLINIC" | "LIST" | null;
};

/**
 * Everything the plan and the write share, worked out once.
 *
 * Both endpoints call this with the same rows and answers, and that is the
 * rule that keeps the import honest: the write must be the plan the vet
 * read, and two separate readings of one file are how they drift apart.
 */
async function analyse(rows: string[][], answers: ImportAnswers, ctx: ActionContext, labels: Record<string, string>) {
  const body = bodyRows(rows, answers.headerRow);
  const [existing, custom, clinic] = await Promise.all([
    prisma.client.findMany({
      where: { clinicId: ctx.clinicId, archivedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        secondaryPhone: true,
        pets: {
          where: { archivedAt: null },
          select: { id: true, name: true, species: true },
        },
      },
    }),
    prisma.customSpecies.findMany({
      where: { clinicId: ctx.clinicId },
      select: { id: true, name: true },
    }),
    prisma.clinic.findUnique({ where: { id: ctx.clinicId }, select: { settings: true } }),
  ]);

  // Where a kept value says it came from: the clinic's own heading, or the
  // field's name when the sheet has no heading row.
  const headings = answers.headerRow ? (rows[0] ?? []) : [];
  const columnLabels: Record<number, string> = {};
  for (const [col, field] of Object.entries(answers.mapping)) {
    const heading = (headings[Number(col)] ?? "").trim();
    columnLabels[Number(col)] = heading || labels[field] || field;
  }
  const vaccineNames: Record<number, string> = {};
  for (const [col, name] of Object.entries(answers.vaccineNames ?? {})) {
    if (name.trim()) vaccineNames[Number(col)] = name.trim().slice(0, 80);
  }

  const today = new Date();
  const plan = buildPlan(body, answers.mapping, answers.dateOrders, existing, {
    vaccineNames,
    columnLabels,
    today,
  });
  const resolved = resolveGroups(plan, answers.duplicates);

  /**
   * The enum tables the vet actually looked at, with their answers on top.
   *
   * The proposals are rebuilt here rather than taken from the request, and
   * that is the whole point: the screen shows every distinct value with a
   * reading already filled in, and a vet who agrees with a line does not
   * touch it. Reading only what came back would mean every line they agreed
   * with arrives EMPTY -- so every cat would be written as "other" and every
   * "Erkek" as "not known", under a screen that said otherwise. The
   * agreement has to be the same function on both sides.
   */
  const speciesProposals = proposeSpecies(columnValues(body, answers.mapping, "pet.species"), custom);
  const speciesTable = new Map(speciesProposals.map((proposal) => [proposal.raw, proposal] as const));
  for (const [raw, answer] of Object.entries(answers.species)) {
    // The answer replaces the proposal whole, breed included: a breed the
    // vet emptied comes back absent, and merging the two would put it back.
    speciesTable.set(raw, {
      raw,
      target: ownedTarget(answer.target, custom),
      breed: answer.breed,
      rows: 0,
      settled: true,
    } as SpeciesProposal);
  }

  const sexProposals = proposeSex(columnValues(body, answers.mapping, "pet.sex"));
  const sexTable = new Map<string, Sex>(
    sexProposals.flatMap((proposal) =>
      proposal.target ? [[proposal.raw, proposal.target] as const] : [],
    ),
  );
  for (const [raw, target] of Object.entries(answers.sex)) sexTable.set(raw, target);

  /**
   * The bulk answer (#42), checked against THIS clinic's own species.
   *
   * An id arrives from the browser, and `customSpeciesId` is the one field on
   * a pet that points at a row the clinic owns. An id that is not in the
   * list this request already read becomes no answer at all -- the rows
   * stay "other", which is what they were without the question.
   */
  const fallback = answers.speciesFallback ?? null;
  const speciesFallback =
    fallback?.kind === "custom" && !custom.some((entry) => entry.id === fallback.id)
      ? null
      : fallback;

  // Which client each row's animal goes under, and whether that client
  // already has an animal of that name. Merged groups only: a client the
  // run creates has no animals yet by definition.
  const mergedClient = new Map<string, string>();
  for (const { group, clientId } of resolved.merging) mergedClient.set(group.key, clientId);
  const clientById = new Map(existing.map((c) => [c.id, c]));
  const existingPetOf = new Map<number, { id: string; species: string }>();
  for (const row of plan.rows) {
    if (!row.pet || !row.ownerKey) continue;
    const ownerKey = resolved.ownerOf.get(row.ownerKey) ?? row.ownerKey;
    const clientId = mergedClient.get(ownerKey);
    if (!clientId) continue;
    const found = clientById
      .get(clientId)
      ?.pets?.find((p) => fold(p.name) === fold(row.pet!.name));
    if (found) existingPetOf.set(row.index, { id: found.id, species: found.species });
  }

  // What those animals already have, so the same rabies date read a second
  // time is recognised rather than written twice.
  const known = existingPetOf.size
    ? await prisma.vaccination.findMany({
        where: { clinicId: ctx.clinicId, petId: { in: [...new Set([...existingPetOf.values()].map((p) => p.id))] } },
        select: { petId: true, name: true, administeredAt: true },
      })
    : [];
  const knownKey = new Set(
    known.map((v) => `${v.petId}|${fold(v.name.trim())}|${v.administeredAt.toISOString().slice(0, 10)}`),
  );

  // The clinic's list, per species, for the next-date proposal.
  const settings = normalizeVaccineSettings(
    ((clinic?.settings ?? {}) as { vaccines?: unknown }).vaccines,
  );
  const listCache = new Map<string, VaccineOffer[]>();
  const historyCache = new Map<string, Awaited<ReturnType<typeof vaccinationIntervalSuggestions>>>();
  async function offersFor(species: string) {
    let offers = listCache.get(species);
    if (!offers) {
      let history = historyCache.get(species);
      if (!history) {
        history = await vaccinationIntervalSuggestions(ctx.clinicId, species);
        historyCache.set(species, history);
      }
      offers = clinicVaccineList(species, settings, history);
      listCache.set(species, offers);
    }
    return offers;
  }

  const speciesOfRow = (row: PlanRow): Species => {
    const existingPet = existingPetOf.get(row.index);
    if (existingPet) return existingPet.species as Species;
    const answer = applySpecies(row.pet!.speciesRaw, row.pet!.breed, speciesTable, speciesFallback);
    return answer.target.kind === "builtIn" ? answer.target.key : "OTHER";
  };

  const items: VaccinationItem[] = [];
  let existingVaccinationCount = 0;
  let proposable = 0;
  const intervals = new Map<string, { name: string; unit: "week" | "month" | "year"; value: number }>();
  const appliedItems: Array<Date> = [];
  for (const row of plan.rows) {
    if (!row.pet || !row.ownerKey || row.vaccinations.length === 0) continue;
    const existingPet = existingPetOf.get(row.index) ?? null;
    const species = speciesOfRow(row);
    for (const draft of row.vaccinations) {
      const day = draft.administeredAt.toISOString().slice(0, 10);
      if (existingPet && knownKey.has(`${existingPet.id}|${fold(draft.name)}|${day}`)) {
        existingVaccinationCount += 1;
        continue;
      }
      let nextDueAt = draft.nextDueAt ? new Date(draft.nextDueAt.getTime() + NOON) : null;
      let nextDueSource: VaccinationItem["nextDueSource"] = nextDueAt ? "MANUAL" : null;
      if (!nextDueAt) {
        const offer = offerByName(await offersFor(species), draft.name);
        const due = offer?.due;
        if (due && (due.kind === "list" || due.kind === "clinic" || due.kind === "history")) {
          proposable += 1;
          intervals.set(`${offer.name}|${due.interval.unit}|${due.interval.value}`, { name: offer.name, ...due.interval });
          const proposed = new Date(`${addInterval(day, due.interval)}T12:00:00Z`);
          appliedItems.push(proposed);
          if (answers.nextDueFromList) {
            nextDueAt = proposed;
            nextDueSource = due.kind === "list" ? "LIST" : due.kind === "clinic" ? "CLINIC" : "HISTORY";
          }
        }
      }
      items.push({
        rowIndex: row.index,
        existingPetId: existingPet?.id ?? null,
        name: draft.name,
        administeredAt: new Date(draft.administeredAt.getTime() + NOON),
        nextDueAt,
        nextDueSource,
      });
    }
  }

  return {
    body,
    plan,
    resolved,
    custom,
    speciesProposals,
    sexProposals,
    speciesTable,
    sexTable,
    speciesFallback,
    existingPetOf,
    items,
    existingVaccinationCount,
    nextDue:
      proposable > 0
        ? {
            proposable,
            intervals: [...intervals.values()],
            ifApplied: dueCounts(
              [
                ...items.filter((i) => i.nextDueSource === "MANUAL").map((i) => i.nextDueAt as Date),
                ...appliedItems,
              ],
              today,
            ),
          }
        : null,
    due: dueCounts(
      items.flatMap((i) => (i.nextDueAt ? [i.nextDueAt] : [])),
      today,
    ),
  };
}

/**
 * Where a set of next dates falls against today, by the dashboard's own
 * rule: the overdue card looks back `OVERDUE_WINDOW_MONTHS`, and a count
 * that disagreed with the card would be the result screen promising rows
 * the dashboard then does not show.
 */
export function dueCounts(dates: readonly Date[], now: Date): DueCounts {
  const since = new Date(now);
  since.setMonth(since.getMonth() - OVERDUE_WINDOW_MONTHS);
  const soon = new Date(now.getTime() + 30 * DAY_MS);
  let overdue = 0;
  let overdueOlder = 0;
  let dueSoon = 0;
  for (const date of dates) {
    if (date < since) overdueOlder += 1;
    else if (date < now) overdue += 1;
    else if (date <= soon) dueSoon += 1;
  }
  return { overdue, overdueOlder, dueSoon };
}

/**
 * The plan, read-only.
 *
 * Runs on the server rather than in the browser even though the browser has
 * the rows, for one reason that is not style: the dedup half needs the
 * clinic's existing clients, and shipping a clinic's client list to the
 * browser to answer a question about a file would be handing over more data
 * than the screen is about.
 */
export async function planImport(
  rows: string[][],
  answers: ImportAnswers,
  ctx: ActionContext,
  labels: Record<string, string> = {},
): Promise<PlanSummary> {
  requirePermission(ctx.userRole, "clients.write");
  requirePermission(ctx.userRole, "pets.write");

  const a = await analyse(rows, answers, ctx, labels);
  const { plan, resolved } = a;

  const open = new Set(openQuestions(plan, answers.duplicates));
  const questionRows = new Set(
    plan.groups.filter((g) => open.has(g.key)).flatMap((g) => g.rowIndexes),
  );
  const columnOf = (field: string) => {
    const found = Object.entries(answers.mapping).find(([, f]) => f === field)?.[0];
    return found === undefined ? undefined : Number(found);
  };
  const views: PlanRowView[] = [];
  for (const row of plan.rows) {
    if (row.issue === "blank") continue;
    const cells = a.body[row.index - 1] ?? [];
    const fixes: PlanRowView["fixes"] = [];
    const fix = (field: string) => {
      const col = columnOf(field);
      if (col !== undefined) fixes.push({ field, col, raw: cells[col] ?? "" });
    };
    let status: PlanRowView["status"] | null = null;
    if (row.issue === "noOwnerName") {
      status = "skip";
      fix("client.firstName");
    } else if (questionRows.has(row.index)) {
      status = "decision";
    } else if (a.existingPetOf.has(row.index)) {
      status = "existing";
    } else if (row.issue === "noPetName" || row.warnings.length > 0) {
      status = "warning";
      if (row.issue === "noPetName") fix("pet.name");
    }
    for (const warning of row.warnings) {
      if (warning.kind === "dateUnreadable" || warning.kind === "yearOnly" || warning.kind === "dateInFuture") {
        fixes.push({ field: warning.field, col: warning.col, raw: warning.raw });
      }
    }
    if (!status) continue;
    views.push({
      index: row.index,
      status,
      ...(row.issue ? { issue: row.issue } : {}),
      warnings: row.warnings,
      owner: row.owner ? [row.owner.firstName, row.owner.lastName ?? ""].join(" ").trim() : (cells[columnOf("client.firstName") ?? -1] ?? null),
      pet: row.pet?.name ?? (cells[columnOf("pet.name") ?? -1] || null),
      fixes,
    });
  }
  // Decisions first, then what will be left out, then the rest: the order
  // a vet works through them in.
  const weight = { decision: 0, skip: 1, warning: 2, existing: 3 } as const;
  views.sort((x, y) => weight[x.status] - weight[y.status] || x.index - y.index);

  const vaccines = new Map<string, number>();
  for (const item of a.items) vaccines.set(item.name, (vaccines.get(item.name) ?? 0) + 1);

  return {
    rowCount: a.body.length,
    createCount: resolved.creating.length,
    mergeCount: resolved.merging.length,
    petCount: plan.rows.filter((r) => r.pet !== null && !a.existingPetOf.has(r.index)).length,
    existingPetCount: a.existingPetOf.size,
    blankRows: plan.skipped.filter((s) => s.issue === "blank").length,
    noOwnerRows: plan.skipped.filter((s) => s.issue === "noOwnerName").length,
    clientOnlyRows: plan.clientOnly.length,
    questions: plan.groups
      .filter((g) => g.possible && g.possible.length > 0)
      .map((g) => ({
        key: g.key,
        name: [g.owner.firstName, g.owner.lastName ?? ""].join(" ").trim(),
        phone: g.owner.phone,
        rows: g.rowIndexes,
        candidates: g.possible ?? [],
      })),
    species: a.speciesProposals,
    sex: a.sexProposals,
    customSpecies: a.custom,
    speciesUnknownRows: plan.rows.filter((r) => r.pet && !r.pet.speciesRaw && !a.existingPetOf.has(r.index)).length,
    vaccinationCount: a.items.length,
    vaccines: [...vaccines].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count),
    existingVaccinationCount: a.existingVaccinationCount,
    nextDue: a.nextDue,
    due: a.due,
    rows: views.slice(0, ROW_VIEW_LIMIT),
    rowsNotShown: Math.max(0, views.length - ROW_VIEW_LIMIT),
  };
}

type Resolved = {
  /** Groups that become a new client. */
  creating: OwnerGroup[];
  /** Groups whose animals go under a client the clinic already has. */
  merging: Array<{ group: OwnerGroup; clientId: string }>;
  /** Group key -> the group key that owns its animals. */
  ownerOf: Map<string, string>;
};

/**
 * The vet's answers applied to the groups.
 *
 * A "same as that other group" answer is followed to its end, so three rows
 * of one person answered in a chain land on one client. The walk is bounded
 * by the number of groups: an answer that points in a circle resolves to
 * wherever it stopped rather than hanging the request.
 */
function resolveGroups(plan: ImportPlan, answers: Record<string, DuplicateAnswer>): Resolved {
  const byKey = new Map(plan.groups.map((g) => [g.key, g]));
  const ownerOf = new Map<string, string>();
  const merging: Resolved["merging"] = [];
  const creating: OwnerGroup[] = [];

  for (const group of plan.groups) {
    const answer = answers[group.key];
    if (group.matchedClientId) {
      merging.push({ group, clientId: group.matchedClientId });
      ownerOf.set(group.key, group.key);
      continue;
    }
    if (answer?.kind === "existing") {
      merging.push({ group, clientId: answer.id });
      ownerOf.set(group.key, group.key);
      continue;
    }
    if (answer?.kind === "group") {
      let target = answer.key;
      const seen = new Set<string>([group.key]);
      for (let step = 0; step < plan.groups.length; step += 1) {
        if (seen.has(target)) break;
        seen.add(target);
        const next = answers[target];
        if (next?.kind !== "group") break;
        target = next.key;
      }
      if (byKey.has(target)) {
        ownerOf.set(group.key, target);
        continue;
      }
    }
    creating.push(group);
    ownerOf.set(group.key, group.key);
  }

  // A group somebody else was merged INTO must still be created, even if it
  // was itself an open question that nobody answered separately.
  for (const [, target] of ownerOf) {
    const group = byKey.get(target);
    if (!group) continue;
    if (creating.includes(group)) continue;
    if (merging.some((m) => m.group.key === target)) continue;
    creating.push(group);
  }

  return { creating, merging, ownerOf };
}

export type CommitResult = {
  batchId: string;
  clientCount: number;
  petCount: number;
  mergedCount: number;
  vaccinationCount: number;
  /** Animals the file named that the clinic already had; not created again. */
  existingPetCount: number;
  due: DueCounts;
};

/**
 * Write the file. One transaction, one batch, and a count of what happened.
 *
 * The timeout is raised from Prisma's default five seconds on purpose: the
 * work is a handful of `createMany` calls, but a file of a few thousand rows
 * is a few thousand rows of INSERT, and a half-written import is the one
 * outcome undo cannot help with.
 */
export async function commitImport(
  rows: string[][],
  answers: ImportAnswers,
  ctx: ActionContext,
  labels: Record<string, string> = {},
): Promise<CommitResult> {
  requirePermission(ctx.userRole, "clients.write");
  requirePermission(ctx.userRole, "pets.write");

  const a = await analyse(rows, answers, ctx, labels);
  const { plan, resolved, speciesTable, sexTable, speciesFallback, custom } = a;
  const unanswered = openQuestions(plan, answers.duplicates);
  if (unanswered.length > 0) {
    // The screen blocks on these too. This is the control: an answer nobody
    // gave must not become a merge just because the request reached here.
    throw validationFailed({ duplicates: ["error.validation.importDuplicatesUnanswered"] });
  }

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          clinicId: ctx.clinicId,
          createdById: ctx.userId,
          fileName: answers.fileName.slice(0, 200),
          sheetName: String(answers.sheetIndex + 1),
        },
        select: { id: true },
      });

      // Species the clinic does not have yet, created once each rather than
      // once per animal. `skipDuplicates` leans on the folded unique index,
      // so two runs in the same second cannot make two "Kirpi".
      const newNames = [
        ...new Set(
          [...speciesTable.values()]
            .filter((p) => p.target.kind === "newCustom")
            .map((p) => (p.target.kind === "newCustom" ? p.target.name : "")),
        ),
      ].filter((name) => name !== "");
      if (newNames.length > 0) {
        await tx.customSpecies.createMany({
          data: newNames.map((name) => ({ clinicId: ctx.clinicId, name })),
          skipDuplicates: true,
        });
      }
      const customAfter = newNames.length > 0 || custom.length > 0
        ? await tx.customSpecies.findMany({
            where: { clinicId: ctx.clinicId },
            select: { id: true, name: true },
          })
        : [];
      const customByName = new Map(customAfter.map((c) => [fold(c.name), c.id]));

      // Ids back in the order they went in, so each group is paired with
      // its own row rather than found again by name -- two clients may
      // share a name, and two animals of one owner may share one (a cat
      // and a dog both called Fındık is in a real file).
      const created =
        resolved.creating.length > 0
          ? await tx.client.createManyAndReturn({
              data: resolved.creating.map((group) => ({
                clinicId: ctx.clinicId,
                importBatchId: batch.id,
                firstName: group.owner.firstName,
                lastName: group.owner.lastName,
                phone: group.owner.phone,
                secondaryPhone: group.owner.secondaryPhone,
                email: group.owner.email,
                city: group.owner.city,
                address: group.owner.address,
                notes: group.owner.notes,
              })),
              select: { id: true },
            })
          : [];

      const clientIdOf = new Map<string, string>();
      for (const { group, clientId } of resolved.merging) clientIdOf.set(group.key, clientId);
      resolved.creating.forEach((group, i) => {
        const id = created[i]?.id;
        if (id) clientIdOf.set(group.key, id);
      });

      const pets: Prisma.PetCreateManyInput[] = [];
      const petRows: number[] = [];
      for (const row of plan.rows) {
        if (!row.pet || !row.ownerKey) continue;
        if (a.existingPetOf.has(row.index)) continue;
        const ownerGroupKey = resolved.ownerOf.get(row.ownerKey) ?? row.ownerKey;
        const ownerId = clientIdOf.get(ownerGroupKey);
        if (!ownerId) continue;

        const answer = applySpecies(
          row.pet.speciesRaw,
          row.pet.breed,
          speciesTable,
          speciesFallback,
        );
        const species = toSpecies(answer.target, customByName);
        pets.push({
          clinicId: ctx.clinicId,
          importBatchId: batch.id,
          ownerId,
          name: row.pet.name,
          species: species.species,
          customSpeciesId: species.customSpeciesId,
          breed: answer.breed,
          // An unanswered value is recorded as "not known", which is what
          // it is. `deceased` is left alone entirely -- see `PetDraft`.
          sex: row.pet.sexRaw ? (sexTable.get(row.pet.sexRaw) ?? "UNKNOWN") : "UNKNOWN",
          birthDate: row.pet.birthDate,
          microchipId: row.pet.microchipId,
          color: row.pet.color,
          weightKg: row.pet.weightKg,
          ...(row.pet.neutered !== null ? { neutered: row.pet.neutered } : {}),
          notes: row.pet.notes,
        });
        petRows.push(row.index);
      }
      const createdPets =
        pets.length > 0
          ? await tx.pet.createManyAndReturn({ data: pets, select: { id: true } })
          : [];
      const petIdOfRow = new Map<number, string>();
      petRows.forEach((rowIndex, i) => {
        const id = createdPets[i]?.id;
        if (id) petIdOfRow.set(rowIndex, id);
      });

      const vaccinations: Prisma.VaccinationCreateManyInput[] = [];
      for (const item of a.items) {
        const petId = item.existingPetId ?? petIdOfRow.get(item.rowIndex);
        if (!petId) continue;
        vaccinations.push({
          clinicId: ctx.clinicId,
          importBatchId: batch.id,
          petId,
          name: item.name,
          administeredAt: item.administeredAt,
          administeredDateOnly: true,
          nextDueAt: item.nextDueAt,
          nextDueSource: item.nextDueAt ? item.nextDueSource : null,
        });
      }
      if (vaccinations.length > 0) await tx.vaccination.createMany({ data: vaccinations });

      const result: CommitResult = {
        batchId: batch.id,
        clientCount: created.length,
        petCount: createdPets.length,
        mergedCount: resolved.merging.length,
        vaccinationCount: vaccinations.length,
        existingPetCount: a.existingPetOf.size,
        due: dueCounts(
          vaccinations.flatMap((v) => (v.nextDueAt ? [new Date(v.nextDueAt)] : [])),
          new Date(),
        ),
      };

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          clientCount: result.clientCount,
          petCount: result.petCount,
          mergedCount: result.mergedCount,
          vaccinationCount: result.vaccinationCount,
        },
      });

      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "CREATE",
          entityType: "ImportBatch",
          entityId: batch.id,
          metadata: {
            fileName: answers.fileName,
            clients: result.clientCount,
            pets: result.petCount,
            merged: result.mergedCount,
            vaccinations: result.vaccinationCount,
          },
        },
        tx,
      );

      return result;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

/**
 * A `custom` answer, checked against the species THIS clinic has.
 *
 * `customSpeciesId` is the one field on a pet that points at a row a clinic
 * owns, and the id arrives in the request body. A foreign key says the row
 * exists somewhere; it does not say it is ours, so without this a forged
 * plan attaches this clinic's animals to another clinic's species -- wrong
 * data and a tenancy boundary crossed in the same write.
 *
 * An id from outside the list this request already read stops being an
 * answer: the row falls back to "other", which is where it was before
 * anybody answered. Not an error, because the honest reading of an
 * unrecognised id is that we do not know what it means, and the screen
 * already says what "other" is.
 */
function ownedTarget(
  target: SpeciesTarget,
  custom: ReadonlyArray<{ id: string }>,
): SpeciesTarget {
  if (target.kind !== "custom") return target;
  return custom.some((entry) => entry.id === target.id) ? target : { kind: "unknown" };
}

function toSpecies(
  target: SpeciesTarget,
  customByName: ReadonlyMap<string, string>,
): { species: Species; customSpeciesId: string | null } {
  switch (target.kind) {
    case "builtIn":
      return { species: target.key, customSpeciesId: null };
    case "custom":
      return { species: "OTHER", customSpeciesId: target.id };
    case "newCustom": {
      const id = customByName.get(fold(target.name)) ?? null;
      return { species: "OTHER", customSpeciesId: id };
    }
    default:
      // The file said nothing about this animal. "Other" is the absence of
      // an answer rather than a species, which is exactly what we have --
      // and the plan screen said how many rows this would be.
      return { species: "OTHER", customSpeciesId: null };
  }
}

export type UndoResult = {
  /** Rows the undo removed. */
  vaccinationCount: number;
  clientCount: number;
  petCount: number;
  /** Rows it left behind because the clinic has since worked on them. */
  keptClients: number;
  keptPets: number;
};

/**
 * Take the import back.
 *
 * Both deletes are one statement with relation filters, so an animal that
 * has been seen, vaccinated, billed or written about survives its own
 * batch, and a client survives while anything at all still points at them.
 * There is no query per row and no list of ids in the statement: an import
 * of five thousand animals is undone by the same two statements as an
 * import of five.
 */
export async function undoImport(batchId: string, ctx: ActionContext): Promise<UndoResult> {
  requirePermission(ctx.userRole, "clients.write");
  requirePermission(ctx.userRole, "pets.write");

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, clinicId: ctx.clinicId },
    select: { id: true, undoneAt: true },
  });
  if (!batch) throw notFound("importBatch", batchId);
  if (batch.undoneAt) throw validationFailed({ batch: ["error.validation.importAlreadyUndone"] });

  return prisma.$transaction(
    async (tx) => {
      // The run's vaccinations first: they are what it wrote onto animals,
      // including animals the clinic already had, and the animals below
      // are only "unused" once these are gone.
      const vaccinationsDeleted = await tx.vaccination.deleteMany({
        where: { clinicId: ctx.clinicId, importBatchId: batchId },
      });

      const petsBefore = await tx.pet.count({
        where: { clinicId: ctx.clinicId, importBatchId: batchId },
      });
      const petsDeleted = await tx.pet.deleteMany({
        where: {
          clinicId: ctx.clinicId,
          importBatchId: batchId,
          visits: { none: {} },
          appointments: { none: {} },
          vaccinations: { none: {} },
          prescriptions: { none: {} },
          treatments: { none: {} },
          diagnostics: { none: {} },
          invoiceLines: { none: {} },
          documents: { none: {} },
          reminders: { none: {} },
          notes_rel: { none: {} },
        },
      });

      const clientsBefore = await tx.client.count({
        where: { clinicId: ctx.clinicId, importBatchId: batchId },
      });
      const clientsDeleted = await tx.client.deleteMany({
        where: {
          clinicId: ctx.clinicId,
          importBatchId: batchId,
          // An animal that survived above keeps its owner: a client with no
          // record left is what the import created and nothing more.
          pets: { none: {} },
          visits: { none: {} },
          appointments: { none: {} },
          invoices: { none: {} },
          documents: { none: {} },
          reminders: { none: {} },
          messages: { none: {} },
          notes_rel: { none: {} },
        },
      });

      await tx.importBatch.update({
        where: { id: batchId },
        data: { undoneAt: new Date() },
      });

      const result: UndoResult = {
        vaccinationCount: vaccinationsDeleted.count,
        clientCount: clientsDeleted.count,
        petCount: petsDeleted.count,
        keptClients: clientsBefore - clientsDeleted.count,
        keptPets: petsBefore - petsDeleted.count,
      };

      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "DELETE",
          entityType: "ImportBatch",
          entityId: batchId,
          metadata: { ...result },
        },
        tx,
      );

      return result;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
