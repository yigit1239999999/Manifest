import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import { isPetSilenced } from "@/lib/pet-status";
import type { ReminderInput } from "./schema";

export async function createReminder(input: ReminderInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "reminders.write");
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, clinicId: ctx.clinicId },
    select: { id: true, archivedAt: true },
  });
  if (!client) throw validationFailed({ clientId: ["error.validation.clientRequired"] });
  // Refused rather than created-and-never-sent. The sweep skips archived
  // clients and silenced animals, so a reminder made here would sit in the
  // list forever looking like work that is going to happen — and a list
  // with rows that never fire is worse than no list at all (TEAM.md #12).
  // Refused *out loud*, on the field: quietly dropping it would make the
  // screen look like it did something it did not (TEAM.md #33).
  if (client.archivedAt)
    throw validationFailed({ clientId: ["error.validation.clientArchived"] });

  if (input.petId) {
    const pet = await prisma.pet.findFirst({
      where: { id: input.petId, clinicId: ctx.clinicId, ownerId: input.clientId },
      select: { id: true, deceased: true, archivedAt: true },
    });
    if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });
    if (isPetSilenced(pet))
      // The message behind this key is long on purpose and says why:
      // "Bu hayvan vefat etmiş ya da arşivlenmiş olduğu için onun adına
      // hatırlatma oluşturulamaz." Do not shorten it. The picker no
      // longer offers a dead animal, so reaching this refusal means
      // something unusual happened — a stale tab, a link, an import —
      // and an unexplained "no" on a field the vet cannot fix is the
      // whole of what they are left with. The sentence is the last
      // protection; `messages/*.json` cannot hold a comment, so it is
      // kept here.
      throw validationFailed({ petId: ["error.validation.petSilenced"] });
  }

  const reminder = await prisma.reminder.create({
    data: {
      clinicId: ctx.clinicId,
      clientId: input.clientId,
      petId: input.petId || null,
      type: input.type,
      title: input.title,
      body: input.body,
      dueAt: input.dueAt,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Reminder",
    entityId: reminder.id,
    changes: { title: reminder.title, dueAt: reminder.dueAt },
  });
  return reminder;
}

/**
 * Moves a reminder between open and closed, in either direction.
 *
 * Reopening is the same call with `PENDING`, and it has to exist because
 * closing is a one-click action on a list: the click next to the one
 * intended closes the wrong row, and without a way back the clinic loses a
 * piece of work it never decided to drop. Archiving taught this the
 * expensive way (backlog 39) — the service could already restore, nothing
 * on screen could, and it read as irreversible.
 *
 * Reopening a reminder that has already gone out does not send it again:
 * `automaticSendBlocked` skips any reminder with a `SENT` or `MANUAL` row
 * against it, so only one that never went out can still go.
 */
export async function markReminderStatus(
  id: string,
  status: "PENDING" | "SENT" | "ACKNOWLEDGED" | "DISMISSED",
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "reminders.write");
  const existing = await prisma.reminder.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("reminder", id);

  await prisma.reminder.update({
    where: { id },
    data: {
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Reminder",
    entityId: id,
    changes: { status },
  });
}
