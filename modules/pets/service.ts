import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { Species } from "@/generated/prisma/enums";
import { SPECIES, type PetInput } from "./schema";

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
async function resolveSpecies(
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

  const existing = await prisma.customSpecies.findFirst({
    where: { clinicId: ctx.clinicId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { species: "OTHER", customSpeciesId: existing.id };

  const created = await prisma.customSpecies.create({
    data: { clinicId: ctx.clinicId, name },
    select: { id: true },
  });
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

export async function updatePet(id: string, input: PetInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.write");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("pet", id);

  await assertOwnerInClinic(input.ownerId, ctx.clinicId);
  const { species: rawSpecies, ...rest } = input;
  const { species, customSpeciesId } = await resolveSpecies(rawSpecies, ctx);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Pet",
      entityId: id,
      changes: redact(input),
    },
    (tx) =>
      tx.pet.update({
        where: { id },
        data: { ...rest, species, customSpeciesId },
      }),
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
