import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

export interface ListVisitsArgs {
  clinicId: string;
  petId?: string | null;
  clientId?: string | null;
  vetId?: string | null;
  type?: string | null;
  from?: Date | null;
  to?: Date | null;
  includeArchived?: boolean;
  take?: number;
}

function buildVisitWhere(args: Omit<ListVisitsArgs, "take">): Prisma.VisitWhereInput {
  return {
    clinicId: args.clinicId,
    ...(args.includeArchived
      ? {}
      : {
          archivedAt: null,
          // Cascade soft-delete: visits hide as soon as their pet or client
          // is archived.
          pet: { archivedAt: null },
          client: { archivedAt: null },
        }),
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

export async function listVisits({ take = PAGE_SIZES.LIST, ...args }: ListVisitsArgs) {
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
  perPage = PAGE_SIZES.DEFAULT,
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
        // `archivedAt` on both sides because a visit is hidden by its own
        // archiving *or* by its pet's or client's, and the row has to be
        // able to say which.
        pet: {
          select: { id: true, name: true, species: true, archivedAt: true },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            archivedAt: true,
          },
        },
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

/**
 * Just what an invoice needs to be opened for a visit.
 *
 * A narrow read on purpose: `getVisitById` pulls the whole record and
 * four lists of clinical rows to draw the visit page, and none of that
 * belongs in a redirect. This is asked in order to decide what to put
 * in a form.
 *
 * `currency` comes along because `totalCents` is meaningless without
 * it. A visit stores the currency it was priced in
 * (20260921170000), and carrying the number without it into an
 * invoice is how a clinic that changed currency would silently re-price
 * its own history -- the defect that column was added to prevent,
 * repeated one table over.
 */
export async function getVisitForInvoice(clinicId: string, id: string) {
  return prisma.visit.findFirst({
    where: { id, clinicId },
    select: {
      id: true,
      type: true,
      visitedAt: true,
      totalCents: true,
      currency: true,
      clientId: true,
      petId: true,
      client: { select: { firstName: true, lastName: true } },
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

export async function recentVisits(clinicId: string, take = PAGE_SIZES.PREVIEW) {
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
