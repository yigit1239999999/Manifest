import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { AppointmentInput } from "./schema";

async function resolvePet(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });
  return pet;
}

export async function createAppointment(
  input: AppointmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const pet = await resolvePet(input.petId, ctx.clinicId);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Appointment",
      changes: redact(input),
    },
    (tx) =>
      tx.appointment.create({
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
      }),
  );
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
