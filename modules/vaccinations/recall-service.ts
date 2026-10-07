import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";


export const RECALL_OUTCOMES = ["CALLED", "UNREACHABLE"] as const;
export type RecallOutcome = (typeof RECALL_OUTCOMES)[number];

/**
 * Records one attempt to reach the owner about one due vaccination.
 *
 * `reminders.write`, not `vaccinations.write`: ringing an owner is the
 * reception desk's work, and the clinical permission would have shut out
 * exactly the person holding the phone. Nothing clinical changes here.
 */
export async function recordRecallContact(
  vaccinationId: string,
  outcome: RecallOutcome,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "reminders.write");
  if (!(RECALL_OUTCOMES as readonly string[]).includes(outcome))
    throw conflict("error.validation.recallOutcome");
  const vaccination = await prisma.vaccination.findFirst({
    where: { id: vaccinationId, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!vaccination) throw notFound("vaccination", vaccinationId);

  const contact = await prisma.recallContact.create({
    data: {
      clinicId: ctx.clinicId,
      vaccinationId,
      outcome,
      byId: ctx.userId,
    },
    select: { id: true },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "RecallContact",
    entityId: contact.id,
    changes: { vaccinationId, outcome },
  });
  return contact;
}

/**
 * Takes back a mark made by mistake -- the toast's undo. Only the person
 * who made it, and only the mark itself: "who tried when" is the record
 * this table exists for, and it cannot be edited by somebody else.
 */
export async function deleteRecallContact(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "reminders.write");
  const existing = await prisma.recallContact.findFirst({
    where: { id, clinicId: ctx.clinicId, byId: ctx.userId },
    select: { id: true, vaccinationId: true, outcome: true },
  });
  if (!existing) throw notFound("vaccination", id);
  await prisma.recallContact.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "RecallContact",
    entityId: id,
    changes: { vaccinationId: existing.vaccinationId, outcome: existing.outcome },
  });
  return existing;
}
