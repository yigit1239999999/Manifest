import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { PetInput } from "./schema";

async function assertOwnerInClinic(ownerId: string, clinicId: string) {
  const owner = await prisma.client.findFirst({
    where: { id: ownerId, clinicId, archivedAt: null },
    select: { id: true },
  });
  if (!owner)
    throw validationFailed({ ownerId: ["Bu sahip bu klinikte bulunamadı."] });
}

export async function createPet(input: PetInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.write");
  await assertOwnerInClinic(input.ownerId, ctx.clinicId);

  const pet = await prisma.pet.create({
    data: { ...input, clinicId: ctx.clinicId },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Pet",
    entityId: pet.id,
    changes: input as unknown as Record<string, unknown>,
  });
  return pet;
}

export async function updatePet(id: string, input: PetInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.write");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("Hasta", id);

  await assertOwnerInClinic(input.ownerId, ctx.clinicId);

  const pet = await prisma.pet.update({ where: { id }, data: input });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Pet",
    entityId: id,
    changes: input as unknown as Record<string, unknown>,
  });
  return pet;
}

export async function archivePet(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "pets.archive");
  const existing = await prisma.pet.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!existing) throw notFound("Hasta", id);

  await prisma.pet.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "ARCHIVE",
    entityType: "Pet",
    entityId: id,
  });
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
  if (!existing) throw notFound("Hasta", id);

  await prisma.pet.update({
    where: { id },
    data: { deceased: true, deceasedAt },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Pet",
    entityId: id,
    changes: { deceased: true, deceasedAt },
  });
}
