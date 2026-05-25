import { prisma } from "@/lib/prisma";

export interface ListVisitsArgs {
  clinicId: string;
  petId?: string | null;
  clientId?: string | null;
  vetId?: string | null;
  from?: Date | null;
  to?: Date | null;
  take?: number;
}

export async function listVisits({
  clinicId,
  petId,
  clientId,
  vetId,
  from,
  to,
  take = 100,
}: ListVisitsArgs) {
  return prisma.visit.findMany({
    where: {
      clinicId,
      archivedAt: null,
      ...(petId ? { petId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(vetId ? { vetId } : {}),
      ...(from || to
        ? {
            visitedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { visitedAt: "desc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      vet: { select: { id: true, name: true } },
    },
  });
}

export async function getVisitById(clinicId: string, id: string) {
  return prisma.visit.findFirst({
    where: { id, clinicId },
    include: {
      pet: true,
      client: true,
      vet: { select: { id: true, name: true } },
      appointment: { select: { id: true, startsAt: true } },
      vaccinations: { orderBy: { administeredAt: "desc" } },
      prescriptions: { orderBy: { startedAt: "desc" } },
      treatments: { orderBy: { performedAt: "desc" } },
      diagnostics: { orderBy: { performedAt: "desc" } },
    },
  });
}

export async function countVisits(clinicId: string) {
  return prisma.visit.count({ where: { clinicId, archivedAt: null } });
}

export async function recentVisits(clinicId: string, take = 5) {
  return prisma.visit.findMany({
    where: { clinicId, archivedAt: null },
    orderBy: { visitedAt: "desc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
