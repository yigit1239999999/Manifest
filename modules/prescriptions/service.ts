import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { requireAllergyOverride } from "@/lib/allergy-check";
import type { ActionContext } from "@/lib/action";
import type { PrescriptionInput } from "./schema";

export async function createPrescription(
  input: PrescriptionInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "prescriptions.write");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true, alerts: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });
  // Throws when the drug matches the animal's allergy and no reason came
  // with it: the vet's "AMOKSİSİLİN ALERJİSİ" cat was given amoxicillin
  // with nothing said.
  const override = requireAllergyOverride(
    pet.alerts,
    input.medicationName,
    input.overrideReason,
  );

  const prescription = await prisma.prescription.create({
    data: {
      clinicId: ctx.clinicId,
      petId: input.petId,
      visitId: input.visitId || null,
      prescribedById: input.prescribedById || ctx.userId,
      medicationName: input.medicationName,
      dosage: input.dosage,
      frequency: input.frequency,
      route: input.route,
      durationDays: input.durationDays,
      refills: input.refills ?? 0,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      status: input.status,
      instructions: input.instructions,
      notes: input.notes,
      overrideReason: override?.reason ?? null,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Prescription",
    entityId: prescription.id,
    changes: { medicationName: prescription.medicationName },
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
  return prescription;
}

export async function updatePrescriptionStatus(
  id: string,
  status: "ACTIVE" | "COMPLETED" | "CANCELLED",
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "prescriptions.write");
  const existing = await prisma.prescription.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("prescription", id);

  await prisma.prescription.update({
    where: { id },
    data: {
      status,
      endedAt: status === "COMPLETED" || status === "CANCELLED" ? new Date() : null,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Prescription",
    entityId: id,
    changes: { status },
  });
  return existing;
}
