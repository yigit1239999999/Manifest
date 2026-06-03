import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { TreatmentInput } from "./schema";

export async function createTreatment(
  input: TreatmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "treatments.write");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });

  const treatment = await prisma.treatment.create({
    data: {
      clinicId: ctx.clinicId,
      petId: input.petId,
      visitId: input.visitId || null,
      performedById: input.performedById || ctx.userId,
      name: input.name,
      code: input.code,
      performedAt: input.performedAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Treatment",
    entityId: treatment.id,
    changes: { name: treatment.name },
  });
  return treatment;
}

export async function deleteTreatment(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "treatments.write");
  const existing = await prisma.treatment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("treatment", id);

  await prisma.treatment.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "Treatment",
    entityId: id,
  });
  return existing;
}
