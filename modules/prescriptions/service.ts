import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { PrescriptionInput } from "./schema";

export async function createPrescription(
  input: PrescriptionInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "prescriptions.write");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });

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
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Prescription",
    entityId: prescription.id,
    changes: { medicationName: prescription.medicationName },
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
