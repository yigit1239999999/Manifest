import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

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

function buildApptWhere(
  args: Omit<ListAppointmentsArgs, "take">,
): Prisma.AppointmentWhereInput {
  return {
    clinicId: args.clinicId,
    // Cascade soft-delete: appointments fall out of view when their pet
    // or client is archived. The row itself isn't deleted.
    pet: { archivedAt: null },
    client: { archivedAt: null },
    ...(args.petId ? { petId: args.petId } : {}),
    ...(args.clientId ? { clientId: args.clientId } : {}),
    ...(args.vetId ? { vetId: args.vetId } : {}),
    ...(args.statuses && args.statuses.length > 0
      ? { status: { in: args.statuses as never } }
      : {}),
    ...(args.from || args.to
      ? {
          startsAt: {
            ...(args.from ? { gte: args.from } : {}),
            ...(args.to ? { lte: args.to } : {}),
          },
        }
      : {}),
  };
}

export async function listAppointments({
  take = PAGE_SIZES.DROPDOWN,
  ...args
}: ListAppointmentsArgs) {
  return prisma.appointment.findMany({
    where: buildApptWhere(args),
    orderBy: { startsAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      vet: { select: { id: true, name: true } },
    },
  });
}

export interface PagedAppointmentsArgs
  extends Omit<ListAppointmentsArgs, "take"> {
  page?: number;
  perPage?: number;
}

export async function listAppointmentsPage({
  page = 1,
  perPage = PAGE_SIZES.DEFAULT,
  ...args
}: PagedAppointmentsArgs) {
  const where = buildApptWhere(args);
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        pet: { select: { id: true, name: true, species: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        vet: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);
  return { items, total, page, perPage };
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

export async function upcomingAppointments(clinicId: string, take = PAGE_SIZES.PREVIEW) {
  return prisma.appointment.findMany({
    where: {
      clinicId,
      pet: { archivedAt: null },
      client: { archivedAt: null },
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
      pet: { archivedAt: null },
      client: { archivedAt: null },
      startsAt: { gte: new Date() },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
  });
}
