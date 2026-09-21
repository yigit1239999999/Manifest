import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { AppointmentInput } from "./schema";
import { notifyAppointmentBooked } from "@/modules/notifications/service";

async function resolvePet(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });
  return pet;
}

/**
 * An animal cannot be in two places at one instant, so the same animal at
 * the same start time is never a second appointment — it is the same one,
 * asked for twice.
 *
 * Cancelled ones are excluded and that is the whole subtlety here: an owner
 * who cancels and calls back an hour later is booking the slot again, for
 * real, and refusing them would be the app inventing a rule nobody has.
 * Every other status means the booking already exists — a no-show or a
 * finished visit at that exact instant is history, not a slot to fill.
 */
function duplicateOf(input: AppointmentInput, petId: string, clinicId: string) {
  return {
    clinicId,
    petId,
    startsAt: input.startsAt,
    status: { not: "CANCELLED" as const },
  };
}

export async function createAppointment(
  input: AppointmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const pet = await resolvePet(input.petId, ctx.clinicId);

  // Booking the same animal into the same instant twice returns the first
  // one instead of making a second.
  //
  // It was reproduced three times out of three: a slow route, the staff
  // member submits again, and the clinic has two identical appointments.
  // The cause does not matter and cannot be enumerated — a double click, a
  // refreshed tab, a dropped connection, a server restart all end the same
  // way — so the fix is at the end all of them share.
  //
  // Not an error: the user asked for an appointment and there is one, at
  // the time they asked, for the animal they asked about. Telling them
  // "already exists" would be technically true and useless. The action
  // redirects to whatever comes back, so a second submit simply lands on
  // the record the first one made.
  //
  // Serializable, because reading then writing is exactly the pattern two
  // overlapping submits defeat: without it both can read "none" and both
  // insert. A partial unique index would close it in the database too and
  // is the right end state; it cannot be added until the one duplicate pair
  // already stored is dealt with, which is a decision about data, not code.
  const { appointment, created } = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: duplicateOf(input, pet.id, ctx.clinicId),
      });
      if (existing) return { appointment: existing, created: false };

      const made = await tx.appointment.create({
        data: {
          clinicId: ctx.clinicId,
          petId: pet.id,
          clientId: pet.ownerId,
          vetId: input.vetId || null,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes ?? 30,
          type: input.type,
          status: input.status,
          reason: input.reason,
          notes: input.notes,
        },
      });
      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "CREATE",
          entityType: "Appointment",
          entityId: made.id,
          changes: redact(input),
        },
        tx,
      );
      return { appointment: made, created: true };
    },
    { isolationLevel: "Serializable" },
  );

  // Only for a booking that actually happened. The confirmation is the
  // reason this matters more than a duplicate row: the owner would get the
  // same message twice, from an app whose whole promise is not to do that.
  if (created) await notifyAppointmentBooked(appointment.id, ctx);
  return appointment;
}

export async function updateAppointment(
  id: string,
  input: AppointmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("appointment", id);

  const pet = await resolvePet(input.petId, ctx.clinicId);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      changes: redact(input),
    },
    (tx) =>
      tx.appointment.update({
        where: { id },
        data: {
          petId: pet.id,
          clientId: pet.ownerId,
          vetId: input.vetId || null,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes ?? 30,
          type: input.type,
          status: input.status,
          reason: input.reason,
          notes: input.notes,
        },
      }),
  );
}

export async function cancelAppointment(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "appointments.write");
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("appointment", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      changes: { status: "CANCELLED" },
    },
    (tx) =>
      tx.appointment.update({ where: { id }, data: { status: "CANCELLED" } }),
  );
  return existing;
}
