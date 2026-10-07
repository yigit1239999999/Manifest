import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";

/**
 * Closes, or brings back, the dashboard's "next steps" card.
 *
 * `Clinic.firstStepHiddenAt` was added for exactly this and left unread
 * until a card existed that a clinic could reasonably decide against: a
 * clinic of one vet is not going to "add the team", and a prompt that
 * cannot go away is read once and then never again. A timestamp, so undo
 * writes null and "never closed" and "put back" are the same state.
 */
export async function setSetupStepsHidden(hidden: boolean, ctx: ActionContext) {
  requirePermission(ctx.userRole, "settings.manage");
  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { firstStepHiddenAt: hidden ? new Date() : null },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { setupStepsHidden: hidden },
  });
}
