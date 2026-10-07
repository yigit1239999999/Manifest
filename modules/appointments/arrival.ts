import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import { refuseEarlyNoShow } from "./service";

/**
 * The one-tap outcomes a day's appointment can be given from a list row:
 * the animal came, or it did not.
 *
 * Its own file and not a branch of `updateAppointment`, because that path
 * takes the whole form and a row has one fact to say. Re-submitting every
 * field to change one is how a stale screen overwrites somebody else's
 * edit of the reason or the vet.
 */
export const ARRIVAL_STATUSES = ["ARRIVED", "NO_SHOW"] as const;
export type ArrivalStatus = (typeof ARRIVAL_STATUSES)[number];

/** Still waiting for one of the two outcomes above. */
const WAITING = ["SCHEDULED", "CONFIRMED"] as const;
type Waiting = (typeof WAITING)[number];

function isWaiting(status: string): status is Waiting {
  return (WAITING as readonly string[]).includes(status);
}

/**
 * Marks a waiting appointment as arrived or missed.
 *
 * "Did not come" is refused before the hour. The vet marked next week's
 * appointment as a no-show from today's screen by mistake, and nothing
 * stopped it: an outcome is a statement about something that has
 * happened, and an appointment whose hour has not come cannot have been
 * missed yet. Arrival is not held to the hour -- people come early. The
 * rule itself is `refuseEarlyNoShow` in `./service.ts`, shared with the
 * appointment form.
 *
 * This is the only one-tap path: the dashboard's "Bugün" strip and the
 * appointments list both call it through `setArrivalAction`, so both
 * offer the same undo.
 */
export async function setArrival(
  id: string,
  status: ArrivalStatus,
  ctx: ActionContext,
  now: Date = new Date(),
) {
  requirePermission(ctx.userRole, "appointments.write");
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      petId: true,
      clientId: true,
      visit: { select: { id: true } },
    },
  });
  if (!existing) throw notFound("appointment", id);
  if (existing.visit) throw conflict("error.validation.appointmentHasVisit");
  if (!isWaiting(existing.status))
    throw conflict("error.validation.appointmentNotWaiting");
  refuseEarlyNoShow(status, existing.startsAt, now, "button");

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      changes: { status: { from: existing.status, to: status } },
    },
    (tx) => tx.appointment.update({ where: { id }, data: { status } }),
  );
  return { ...existing, previous: existing.status as Waiting };
}

/**
 * Takes a one-tap outcome back, to the waiting status it replaced.
 *
 * Only from the two outcomes this file sets, and only while no visit
 * answers the appointment: a toast's undo must not become a back door
 * for reopening a finished day.
 */
export async function undoArrival(
  id: string,
  previous: string,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  if (!isWaiting(previous))
    throw conflict("error.validation.appointmentNotWaiting");
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: {
      id: true,
      status: true,
      petId: true,
      clientId: true,
      visit: { select: { id: true } },
    },
  });
  if (!existing) throw notFound("appointment", id);
  if (existing.visit) throw conflict("error.validation.appointmentHasVisit");
  if (!(ARRIVAL_STATUSES as readonly string[]).includes(existing.status))
    throw conflict("error.validation.appointmentNotWaiting");

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      changes: { status: { from: existing.status, to: previous } },
    },
    (tx) => tx.appointment.update({ where: { id }, data: { status: previous } }),
  );
  return existing;
}
