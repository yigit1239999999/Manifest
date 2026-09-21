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
