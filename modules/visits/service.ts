import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { VisitInput } from "./schema";
import { isClinician } from "@/modules/staff/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";

async function resolvePetAndOwner(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petNotInClinic"] });
  return pet;
}

/**
 * The vet a visit or appointment is recorded against, checked rather than
 * trusted.
 *
 * The screens offer only clinicians (`listClinicians`), and a screen's
 * filter is not a rule — a stale tab, a replayed submit or the next screen
 * someone writes will all get past it. What is at stake is not access:
 * this field says who treated the animal, and nobody goes back to correct
 * it, so a receptionist saved here is wrong in the record for good.
 *
 * Empty is allowed and means "not recorded". That is a real answer, and a
 * better one than a name nobody chose.
 */
/**
 * The currency a visit's total is recorded in, stamped at the time rather
 * than read back later.
 *
 * Same rule as an invoice's, and it was missing here for the same reason
 * it was missing there: the total looked like a plain number. It is not —
 * printed against the clinic's *current* setting, every visit ever
 * recorded is silently restated the first time a clinic switches.
 *
 * Null when there is no total. The two travel together: a currency with
 * no amount says nothing, and an amount with no currency is the defect.
 */
async function stampCurrency(
  total: number | null | undefined,
  clinicId: string,
): Promise<string | null> {
  if (total == null) return null;
  return getClinicCurrency(clinicId);
}

async function resolveVet(
  vetId: string | null | undefined,
  clinicId: string,
): Promise<string | null> {
  const id = vetId?.trim();
  if (!id) return null;
  if (!(await isClinician(clinicId, id)))
    throw validationFailed({ vetId: ["error.validation.vetRequired"] });
  return id;
}

export async function createVisit(input: VisitInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, total, ...rest } = input;
  // Was `vetId || ctx.userId`: leaving the field blank made whoever filled
  // the form in the vet on the record, so a receptionist writing up a
  // visit became the clinician who performed it. Unrecorded is the honest
  // answer, and the person who typed it is in the audit trail either way.
  const vet = await resolveVet(vetId, ctx.clinicId);
  const currency = await stampCurrency(total, ctx.clinicId);

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
          totalCents: total,
          currency,
          clinicId: ctx.clinicId,
          petId,
          clientId: pet.ownerId,
          vetId: vet,
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
  if (!existing) throw notFound("visit", id);

  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, total, ...rest } = input;
  const vet = await resolveVet(vetId, ctx.clinicId);
  const currency = await stampCurrency(total, ctx.clinicId);

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
          totalCents: total,
          currency,
          petId,
          clientId: pet.ownerId,
          vetId: vet,
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
  if (!existing) throw notFound("visit", id);

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

export async function restoreVisit(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("visit", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "RESTORE",
      entityType: "Visit",
      entityId: id,
    },
    (tx) => tx.visit.update({ where: { id }, data: { archivedAt: null } }),
  );
  return existing;
}
