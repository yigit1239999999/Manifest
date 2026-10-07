import { prisma } from "@/lib/prisma";
import { isUniqueViolation, notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { Species } from "@/generated/prisma/enums";
import { fold } from "@/lib/search";
import { SPECIES, type PetInput } from "./schema";
import { builtInSpeciesNamed } from "./species-names";
import { ownerLabel } from "@/lib/pet-label";
import { OPEN_REMINDER_STATUSES } from "@/modules/reminders/queries";

async function assertOwnerInClinic(ownerId: string, clinicId: string) {
  const owner = await prisma.client.findFirst({
    where: { id: ownerId, clinicId, archivedAt: null },
    select: { id: true },
  });
  if (!owner)
    throw validationFailed({ ownerId: ["error.validation.ownerNotInClinic"] });
}

const SPECIES_SET: ReadonlySet<string> = new Set(SPECIES);

/**
 * Resolves the form's species value into enum + custom reference.
 * - Built-in enum value ("DOG") → that enum, no custom row.
 * - "custom:<id>" → OTHER + the clinic's existing custom species.
 * - Anything else → OTHER + a clinic-scoped custom species, created on the
 *   fly ("her kliniğin kendi dünyası": vets grow their own species list).
 */
/**
 * Exported for the intake form, which records an animal inside the
 * visit that brought it in (`modules/visits/service.ts`).
 *
 * Shared rather than copied, because this is where "Kedi" typed by
 * hand becomes CAT rather than a clinic-defined species called Kedi --
 * the defect that took a cat out of every report that groups by
 * species. A second implementation would recreate it on the new
 * screen, where nobody would look for it.
 */
export async function resolveSpecies(
  raw: string,
  ctx: ActionContext,
): Promise<{ species: Species; customSpeciesId: string | null }> {
  if (SPECIES_SET.has(raw)) {
    return { species: raw as Species, customSpeciesId: null };
  }

  if (raw.startsWith("custom:")) {
    const id = raw.slice("custom:".length);
    const existing = await prisma.customSpecies.findFirst({
      where: { id, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!existing)
      throw validationFailed({ species: ["error.validation.speciesUnknown"] });
    return { species: "OTHER", customSpeciesId: existing.id };
  }

  const name = raw.trim();
  if (!name)
    throw validationFailed({ species: ["error.validation.speciesUnknown"] });

  // A vet types "Kedi", not "CAT". The check above compares against enum
  // keys, so the typed name fell through to the custom path and the
  // clinic grew a species called "Kedi": the animal was stored as OTHER
  // with a custom species beside it, and dropped out of every list that
  // groups by CAT. The cat was in the building and not in the report.
  //
  // Here rather than only in the picker, because the picker is a
  // convenience and this is the guarantee. Fix the picker alone and the
  // next import, or the next form, recreates the duplicate -- making it
  // impossible beats writing down that it must not happen.
  //
  // Disabled species included on purpose: turning one off governs what
  // the picker offers, not what exists. Recording a cat as something
  // else to respect a display setting is a lie in the data.
  const builtIn = builtInSpeciesNamed(name);
  if (builtIn) return { species: builtIn, customSpeciesId: null };

  // Folded, not `mode: "insensitive"`. ILIKE folds case and nothing
  // else, so "Kopek" did not find "Köpek" and the clinic ended up with
  // both: the picker offered two species forever, animals were filed
  // under either, and nothing in the product can merge them back. A
  // search that misses is recoverable by typing again; this one writes.
  const nameKey = fold(name);
  const existing = await prisma.customSpecies.findFirst({
    where: { clinicId: ctx.clinicId, nameKey },
    select: { id: true },
  });
  if (existing) return { species: "OTHER", customSpeciesId: existing.id };

  let created: { id: string };
  try {
    created = await prisma.customSpecies.create({
      data: { clinicId: ctx.clinicId, name },
      select: { id: true },
    });
  } catch (e) {
    // Two vets adding "Papağan" in the same second both read nothing
    // and both insert. The read above cannot close that window and the
    // unique index can, so the loser reads the winner's row instead of
    // failing at a vet who did nothing wrong.
    if (!isUniqueViolation(e)) throw e;
    const winner = await prisma.customSpecies.findFirst({
      where: { clinicId: ctx.clinicId, nameKey },
      select: { id: true },
    });
    if (!winner) throw e;
    return { species: "OTHER", customSpeciesId: winner.id };
  }

  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "CustomSpecies",
    entityId: created.id,
    metadata: { name },
  });
  return { species: "OTHER", customSpeciesId: created.id };
}

export async function createPet(input: PetInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.write");
  await assertOwnerInClinic(input.ownerId, ctx.clinicId);
  const { species: rawSpecies, ...rest } = input;
  const { species, customSpeciesId } = await resolveSpecies(rawSpecies, ctx);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Pet",
      changes: redact(input),
    },
    (tx) =>
      tx.pet.create({
        data: { ...rest, species, customSpeciesId, clinicId: ctx.clinicId },
      }),
  );
}

export interface OwnerChangeOptions {
  /** The person saving said yes to moving the animal to another owner. */
  confirmed?: boolean;
  /**
   * The sentence each owner's history gets, in the language of the
   * person who made the change: "Sahip değişti: A → B".
   */
  describe?: (args: { pet: string; from: string; to: string }) => string;
}

export async function updatePet(
  id: string,
  input: PetInput,
  ctx: ActionContext,
  ownerChange: OwnerChangeOptions = {},
) {
  requirePermission(ctx.userRole, "pets.write");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      birthDate: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!existing) throw notFound("pet", id);

  await assertOwnerInClinic(input.ownerId, ctx.clinicId);
  const { species: rawSpecies, ...rest } = input;
  const { species, customSpeciesId } = await resolveSpecies(rawSpecies, ctx);
  // An estimated birth date (an import's "2021" read as 1 January) stops
  // being an estimate the moment somebody types a different one.
  const birthDateChanged =
    (input.birthDate?.getTime() ?? null) !== (existing.birthDate?.getTime() ?? null);

  // A change of owner is asked about and leaves a trace (pm B12). Before
  // this it happened silently: the animal, its reminders and its history
  // moved to somebody else and neither client's page said so.
  const ownerChanged = input.ownerId !== existing.ownerId;
  if (ownerChanged && !ownerChange.confirmed) {
    throw validationFailed({ ownerId: ["error.validation.ownerChangeUnconfirmed"] });
  }
  const newOwner = ownerChanged
    ? await prisma.client.findFirst({
        where: { id: input.ownerId, clinicId: ctx.clinicId },
        select: { id: true, firstName: true, lastName: true },
      })
    : null;
  const from = ownerLabel(existing.owner);
  const to = newOwner ? ownerLabel(newOwner) : "";

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Pet",
      entityId: id,
      // The names beside the ids, so the audit log reads "Ayşe Tekin →
      // Mehmet Kaya" and not two cuids nobody can check by eye.
      changes: ownerChanged
        ? {
            ...(redact(input) as Record<string, unknown>),
            owner: {
              from: { id: existing.ownerId, name: from },
              to: { id: input.ownerId, name: to },
            },
          }
        : redact(input),
    },
    async (tx) => {
      const pet = await tx.pet.update({
        where: { id },
        data: {
          ...rest,
          species,
          customSpeciesId,
          ...(birthDateChanged ? { birthDateEstimated: false } : {}),
        },
      });
      if (ownerChanged) {
        // What is still to come follows the animal: the open reminders
        // and the bookings ahead would otherwise go to, and be confirmed
        // with, somebody who no longer owns it. What already happened --
        // visits, invoices, past appointments -- stays with the owner it
        // happened to, who is who paid.
        await tx.reminder.updateMany({
          where: {
            clinicId: ctx.clinicId,
            petId: id,
            clientId: existing.ownerId,
            status: { in: [...OPEN_REMINDER_STATUSES] },
          },
          data: { clientId: input.ownerId },
        });
        await tx.appointment.updateMany({
          where: {
            clinicId: ctx.clinicId,
            petId: id,
            clientId: existing.ownerId,
            startsAt: { gte: new Date() },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
          data: { clientId: input.ownerId },
        });
        const body =
          ownerChange.describe?.({ pet: existing.name, from, to }) ??
          `${existing.name}: ${from} → ${to}`;
        // One entry on each owner's timeline: the old owner's history
        // says where the animal went, the new one's where it came from --
        // the same sentence, so the two can be matched. Only the second
        // carries the animal, so the animal's own timeline (which reads
        // notes by `petId`) shows the change once, not twice.
        await tx.note.createMany({
          data: [
            { clientId: existing.ownerId, petId: null as string | null },
            { clientId: input.ownerId, petId: id },
          ].map((link) => ({
            clinicId: ctx.clinicId,
            ...link,
            authorId: ctx.userId,
            kind: "EVENT" as const,
            body,
          })),
        });
      }
      return pet;
    },
  );
}

export async function archivePet(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.archive");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!existing) throw notFound("pet", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "ARCHIVE",
      entityType: "Pet",
      entityId: id,
    },
    (tx) => tx.pet.update({ where: { id }, data: { archivedAt: new Date() } }),
  );
  return existing;
}

export async function restorePet(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.archive");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, ownerId: true },
  });
  if (!existing) throw notFound("pet", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "RESTORE",
      entityType: "Pet",
      entityId: id,
    },
    (tx) => tx.pet.update({ where: { id }, data: { archivedAt: null } }),
  );
  return existing;
}

export async function markPetDeceased(
  id: string,
  deceasedAt: Date,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "pets.write");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("pet", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Pet",
      entityId: id,
      changes: { deceased: true, deceasedAt: deceasedAt.toISOString() },
    },
    (tx) =>
      tx.pet.update({ where: { id }, data: { deceased: true, deceasedAt } }),
  );
}
