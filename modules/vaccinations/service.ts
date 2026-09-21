import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { VaccinationInput } from "./schema";

export async function createVaccination(
  input: VaccinationInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "vaccinations.write");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });

  const vaccination = await prisma.vaccination.create({
    data: {
      clinicId: ctx.clinicId,
      petId: input.petId,
      visitId: input.visitId || null,
      administeredById: input.administeredById || ctx.userId,
      name: input.name,
      manufacturer: input.manufacturer,
      lotNumber: input.lotNumber,
      site: input.site,
      administeredAt: input.administeredAt,
      nextDueAt: input.nextDueAt,
      notes: input.notes,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Vaccination",
    entityId: vaccination.id,
    changes: { name: vaccination.name, petId: vaccination.petId },
  });
  return vaccination;
}

/**
 * Closes an overdue vaccination row, or puts it back.
 *
 * One function in both directions, like `markReminderStatus`, and for
 * the same reason: closing is a one-click action in a list, the click
 * next to the intended one closes the wrong row, and without a way
 * back the clinic silently loses a piece of work it never decided to
 * drop. Archiving taught this expensively once already.
 *
 * What it closes is the row. `Pet.archivedAt` is not touched and the
 * vaccination stays on the animal's page: "I have dealt with this one"
 * is a much smaller statement than "this animal is gone", and a card
 * that made the larger one on a click would be a trap.
 */
export async function setVaccinationDueDismissed(
  id: string,
  dismissed: boolean,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "vaccinations.write");
  const existing = await prisma.vaccination.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("vaccination", id);

  await prisma.vaccination.update({
    where: { id },
    data: { dueDismissedAt: dismissed ? new Date() : null },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Vaccination",
    entityId: id,
    changes: { dueDismissed: dismissed },
  });
  return existing;
}

export async function deleteVaccination(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "vaccinations.write");
  const existing = await prisma.vaccination.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("vaccination", id);

  await prisma.vaccination.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "Vaccination",
    entityId: id,
  });
  return existing;
}
