import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { VisitInput } from "./schema";

async function resolvePetAndOwner(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["Bu hasta bu klinikte bulunamadı."] });
  return pet;
}

export async function createVisit(input: VisitInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, ...rest } = input;

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Visit",
      changes: redact(input),
    },
    (tx) =>
      tx.visit.create({
        data: {
          ...rest,
          clinicId: ctx.clinicId,
          petId,
          clientId: pet.ownerId,
          vetId: vetId || ctx.userId,
        },
      }),
  );
}

export async function updateVisit(
  id: string,
  input: VisitInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("Vizit", id);

  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, ...rest } = input;

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Visit",
      entityId: id,
      changes: redact(input),
    },
    (tx) =>
      tx.visit.update({
        where: { id },
        data: {
          ...rest,
          petId,
          clientId: pet.ownerId,
          vetId: vetId || null,
        },
      }),
  );
}

export async function archiveVisit(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("Vizit", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "ARCHIVE",
      entityType: "Visit",
      entityId: id,
    },
    (tx) =>
      tx.visit.update({ where: { id }, data: { archivedAt: new Date() } }),
  );
  return existing;
}
