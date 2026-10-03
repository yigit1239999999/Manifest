import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { fold } from "@/lib/search";
import { normalizePhone } from "@/lib/phone";
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
} from "./plan";

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
};

/** What the screen shows before anything is written. */
export type PlanSummary = {
  rowCount: number;
  /** People this run would create. */
  createCount: number;
  /** People it would attach animals to, because name and phone both agree. */
  mergeCount: number;
  petCount: number;
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
};

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
): Promise<PlanSummary> {
  requirePermission(ctx.userRole, "clients.write");
  requirePermission(ctx.userRole, "pets.write");

  const body = bodyRows(rows, answers.headerRow);
  const [existing, custom] = await Promise.all([
    prisma.client.findMany({
      where: { clinicId: ctx.clinicId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, secondaryPhone: true },
    }),
    prisma.customSpecies.findMany({
      where: { clinicId: ctx.clinicId },
      select: { id: true, name: true },
    }),
  ]);

  const plan = buildPlan(body, answers.mapping, answers.dateOrders, existing);
  const speciesValues = columnValues(body, answers.mapping, "pet.species");
  const species = proposeSpecies(speciesValues, custom);
  const sex = proposeSex(columnValues(body, answers.mapping, "pet.sex"));

  const resolved = resolveGroups(plan, answers.duplicates);
  return {
    rowCount: body.length,
    createCount: resolved.creating.length,
    mergeCount: resolved.merging.length,
    petCount: plan.rows.filter((r) => r.pet !== null).length,
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
    species,
    sex,
    customSpecies: custom,
    speciesUnknownRows: plan.rows.filter((r) => r.pet && !r.pet.speciesRaw).length,
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
): Promise<CommitResult> {
  requirePermission(ctx.userRole, "clients.write");
  requirePermission(ctx.userRole, "pets.write");

  const body = bodyRows(rows, answers.headerRow);
  const [existing, custom] = await Promise.all([
    prisma.client.findMany({
      where: { clinicId: ctx.clinicId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, secondaryPhone: true },
    }),
    prisma.customSpecies.findMany({
      where: { clinicId: ctx.clinicId },
      select: { id: true, name: true },
    }),
  ]);

  const plan = buildPlan(body, answers.mapping, answers.dateOrders, existing);
  const unanswered = openQuestions(plan, answers.duplicates);
  if (unanswered.length > 0) {
    // The screen blocks on these too. This is the control: an answer nobody
    // gave must not become a merge just because the request reached here.
    throw validationFailed({ duplicates: ["error.validation.importDuplicatesUnanswered"] });
  }

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
  const speciesTable = new Map(
    proposeSpecies(columnValues(body, answers.mapping, "pet.species"), custom).map(
      (proposal) => [proposal.raw, proposal] as const,
    ),
  );
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

  const sexTable = new Map<string, Sex>(
    proposeSex(columnValues(body, answers.mapping, "pet.sex")).flatMap((proposal) =>
      proposal.target ? [[proposal.raw, proposal.target] as const] : [],
    ),
  );
  for (const [raw, target] of Object.entries(answers.sex)) sexTable.set(raw, target);

  /**
   * The bulk answer (#42), checked against THIS clinic's own species.
   *
   * An id arrives from the browser, and `customSpeciesId` is the one field on
   * a pet that points at a row the clinic owns. A foreign key only says the
   * row exists somewhere; it does not say it is ours. An id that is not in
   * the list this request already read becomes no answer at all -- the rows
   * stay "other", which is what they were without the question.
   *
   * WHAT THIS DOES NOT CLOSE, so it is not read as closed: the per-value
   * species table takes ids the same way and does NOT check them
   * (`toSpecies`, case "custom"). That is older than this field and reported
   * rather than fixed here.
   */
  const fallback = answers.speciesFallback ?? null;
  const speciesFallback =
    fallback?.kind === "custom" && !custom.some((entry) => entry.id === fallback.id)
      ? null
      : fallback;

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

      if (resolved.creating.length > 0) {
        await tx.client.createMany({
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
        });
      }

      // Read the new ids back by the batch rather than inserting one at a
      // time for the id. `createMany` cannot return ids, and a create per
      // client would be one round trip per person in the file.
      const created =
        resolved.creating.length > 0
          ? await tx.client.findMany({
              where: { clinicId: ctx.clinicId, importBatchId: batch.id },
              select: { id: true, firstName: true, lastName: true, phone: true },
            })
          : [];
      const createdByKey = new Map(
        created.map((c) => [
          `${fold([c.firstName, c.lastName ?? ""].join(" ").trim())} ${normalizePhone(c.phone) ?? ""}`,
          c.id,
        ]),
      );

      const clientIdOf = new Map<string, string>();
      for (const { group, clientId } of resolved.merging) clientIdOf.set(group.key, clientId);
      for (const group of resolved.creating) {
        const id = createdByKey.get(group.key);
        if (id) clientIdOf.set(group.key, id);
      }

      const pets: Prisma.PetCreateManyInput[] = [];
      for (const row of plan.rows) {
        if (!row.pet || !row.ownerKey) continue;
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
          notes: row.pet.notes,
        });
      }
      if (pets.length > 0) await tx.pet.createMany({ data: pets });

      const result: CommitResult = {
        batchId: batch.id,
        clientCount: created.length,
        petCount: pets.length,
        mergedCount: resolved.merging.length,
      };

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          clientCount: result.clientCount,
          petCount: result.petCount,
          mergedCount: result.mergedCount,
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
          },
        },
        tx,
      );

      return result;
    },
    { timeout: 60_000, maxWait: 10_000 },
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
