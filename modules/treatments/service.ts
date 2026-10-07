import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { refuseDuplicate, sameMinute } from "@/lib/duplicate-guard";
import { requireAllergyOverride } from "@/lib/allergy-check";
import type { ActionContext } from "@/lib/action";
import type { TreatmentInput } from "./schema";

export async function createTreatment(
  input: TreatmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "treatments.write");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true, alerts: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });
  // A treatment is often a drug given in the clinic ("Amoksisilin
  // enjeksiyonu"), so it is held to the same check as a prescription.
  const override = requireAllergyOverride(pet.alerts, input.name, input.overrideReason);

  refuseDuplicate(
    await prisma.treatment.findFirst({
      where: {
        clinicId: ctx.clinicId,
        petId: input.petId,
        name: { equals: input.name, mode: "insensitive" },
        performedAt: sameMinute(input.performedAt),
      },
      select: { id: true },
    }),
    input.name,
  );

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
      overrideReason: override?.reason ?? null,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Treatment",
    entityId: treatment.id,
    changes: { name: treatment.name },
    ...(override && {
      metadata: {
        allergyOverride: {
          allergy: override.conflict.allergy,
          family: override.conflict.family,
          reason: override.reason,
        },
      },
    }),
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
