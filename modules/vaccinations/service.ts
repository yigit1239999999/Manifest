import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { refuseDuplicate, sameMinute } from "@/lib/duplicate-guard";
import type { ActionContext } from "@/lib/action";
import type { VaccinationInput } from "./schema";
import { normalizeVaccineSettings, type VaccineSettings } from "./catalogue";

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

  refuseDuplicate(
    await prisma.vaccination.findFirst({
      where: {
        clinicId: ctx.clinicId,
        petId: input.petId,
        name: { equals: input.name, mode: "insensitive" },
        administeredAt: sameMinute(input.administeredAt),
      },
      select: { id: true },
    }),
    input.name,
  );

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
      // The source belongs to the date. Writing one without the other
      // would leave a record claiming a provenance for a date it does not
      // have -- and a null date with a source reads, six months later, as
      // a schedule somebody deleted.
      nextDueSource: input.nextDueAt ? (input.nextDueSource ?? null) : null,
      doseNumber: input.doseNumber ?? null,
      seriesOf: input.seriesOf ?? null,
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

/**
 * What this clinic wants its vaccine list to be.
 *
 * Merged into `Clinic.settings` the way `setEnabledSpecies` does it, so the
 * other keys in there survive a save. The list itself is not stored --
 * only the DIFFERENCE between the shipped one and theirs, which is what
 * keeps a clinic that has never opened this screen from carrying a frozen
 * copy of a list we may correct tomorrow.
 *
 * ŞART C is the reason the `hidden` half exists at all, in the vet's own
 * words: "Ben köpek öksürüğünü çoğu hastada hiç yazmıyorum, listede hep
 * durursa gözümü yorar." Hiding is not deleting: the vaccine stays a name
 * anybody can type, and every record already written under it is
 * untouched. A list is what gets offered, not what is allowed.
 */
export async function setVaccineSettings(
  input: VaccineSettings,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "settings.manage");

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { settings: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);

  const current =
    clinic.settings && typeof clinic.settings === "object" && !Array.isArray(clinic.settings)
      ? (clinic.settings as Record<string, unknown>)
      : {};

  // Normalised on the way in as well as on the way out. The screen is not
  // the only caller this could ever have, and a half-readable override
  // stored now is a proposed date later.
  const vaccines = normalizeVaccineSettings(input);

  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { settings: { ...current, vaccines } as Prisma.InputJsonValue },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: {
      hidden: vaccines.hidden.length,
      intervals: Object.keys(vaccines.intervals).length,
      added: vaccines.added.length,
    },
  });
  return vaccines;
}
