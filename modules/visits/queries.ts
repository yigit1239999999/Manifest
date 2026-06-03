import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface ListVisitsArgs {
  clinicId: string;
  petId?: string | null;
  clientId?: string | null;
  vetId?: string | null;
  type?: string | null;
  from?: Date | null;
  to?: Date | null;
  take?: number;
}

function buildVisitWhere(args: Omit<ListVisitsArgs, "take">): Prisma.VisitWhereInput {
  return {
    clinicId: args.clinicId,
    archivedAt: null,
    // Cascade soft-delete: visits hide as soon as their pet or client is archived.
    pet: { archivedAt: null },
    client: { archivedAt: null },
    ...(args.petId ? { petId: args.petId } : {}),
    ...(args.clientId ? { clientId: args.clientId } : {}),
    ...(args.vetId ? { vetId: args.vetId } : {}),
    ...(args.type ? { type: args.type as never } : {}),
    ...(args.from || args.to
      ? {
          visitedAt: {
            ...(args.from ? { gte: args.from } : {}),
            ...(args.to ? { lte: args.to } : {}),
          },
        }
      : {}),
  };
}

export async function listVisits({ take = 100, ...args }: ListVisitsArgs) {
  return prisma.visit.findMany({
    where: buildVisitWhere(args),
    orderBy: { visitedAt: "desc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      vet: { select: { id: true, name: true } },
    },
  });
}

export interface PagedVisitsArgs extends Omit<ListVisitsArgs, "take"> {
  page?: number;
  perPage?: number;
}

export async function listVisitsPage({
  page = 1,
  perPage = 25,
  ...args
}: PagedVisitsArgs) {
  const where = buildVisitWhere(args);
  const [items, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      orderBy: { visitedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        pet: { select: { id: true, name: true, species: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        vet: { select: { id: true, name: true } },
      },
    }),
    prisma.visit.count({ where }),
  ]);
  return { items, total, page, perPage };
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
  return prisma.visit.count({
    where: {
      clinicId,
      archivedAt: null,
      pet: { archivedAt: null },
      client: { archivedAt: null },
    },
  });
}

export async function recentVisits(clinicId: string, take = 5) {
  return prisma.visit.findMany({
    where: {
      clinicId,
      archivedAt: null,
      pet: { archivedAt: null },
      client: { archivedAt: null },
    },
    orderBy: { visitedAt: "desc" },
    take,
    include: {
      pet: { select: { id: true, name: true, species: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
