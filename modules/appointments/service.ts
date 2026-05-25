import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { AppointmentInput } from "./schema";

async function resolvePet(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["Hasta bulunamadı."] });
  return pet;
}

export async function createAppointment(
  input: AppointmentInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const pet = await resolvePet(input.petId, ctx.clinicId);

  const appointment = await prisma.appointment.create({
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
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Appointment",
    entityId: appointment.id,
    changes: input as unknown as Record<string, unknown>,
  });
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
  if (!existing) throw notFound("Randevu", id);

  const pet = await resolvePet(input.petId, ctx.clinicId);

  const appointment = await prisma.appointment.update({
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
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Appointment",
    entityId: id,
    changes: input as unknown as Record<string, unknown>,
  });
  return appointment;
}

export async function cancelAppointment(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "appointments.write");
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("Randevu", id);

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Appointment",
    entityId: id,
    changes: { status: "CANCELLED" },
  });
  return existing;
}
