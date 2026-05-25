import { prisma } from "@/lib/prisma";

export interface ListClientsArgs {
  clinicId: string;
  search?: string | null;
  includeArchived?: boolean;
  take?: number;
}

export async function listClients({
  clinicId,
  search,
  includeArchived = false,
  take = 200,
}: ListClientsArgs) {
  const term = search?.trim();
  return prisma.client.findMany({
    where: {
      clinicId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: term } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    include: {
      _count: { select: { pets: { where: { archivedAt: null } } } },
    },
  });
}

export async function getClientById(clinicId: string, id: string) {
  return prisma.client.findFirst({
    where: { id, clinicId },
    include: {
      pets: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { visits: true, appointments: true, invoices: true } },
    },
  });
}

export async function countClients(clinicId: string) {
  return prisma.client.count({ where: { clinicId, archivedAt: null } });
}
