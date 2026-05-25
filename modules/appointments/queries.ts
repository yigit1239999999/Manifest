import { prisma } from "@/lib/prisma";

export interface ListAppointmentsArgs {
  clinicId: string;
  from?: Date | null;
  to?: Date | null;
  petId?: string | null;
  clientId?: string | null;
  vetId?: string | null;
  statuses?: string[] | null;
  take?: number;
}

export async function listAppointments({
  clinicId,
  from,
  to,
  petId,
  clientId,
  vetId,
  statuses,
  take = 200,
}: ListAppointmentsArgs) {
  return prisma.appointment.findMany({
    where: {
      clinicId,
      ...(petId ? { petId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(vetId ? { vetId } : {}),
      ...(statuses && statuses.length > 0
        ? { status: { in: statuses as never } }
        : {}),
      ...(from || to
        ? {
            startsAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      vet: { select: { id: true, name: true } },
    },
  });
}

export async function getAppointmentById(clinicId: string, id: string) {
  return prisma.appointment.findFirst({
    where: { id, clinicId },
    include: {
      pet: true,
      client: true,
      vet: { select: { id: true, name: true } },
      visit: { select: { id: true } },
    },
  });
}

export async function upcomingAppointments(clinicId: string, take = 5) {
  return prisma.appointment.findMany({
    where: {
      clinicId,
      startsAt: { gte: new Date() },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { startsAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function countUpcomingAppointments(clinicId: string) {
  return prisma.appointment.count({
    where: {
      clinicId,
      startsAt: { gte: new Date() },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
  });
}
