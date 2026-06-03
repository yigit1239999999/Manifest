import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZES } from "@/lib/pagination";

export interface ListClientsArgs {
  clinicId: string;
  search?: string | null;
  includeArchived?: boolean;
  take?: number;
}

function buildClientWhere(args: {
  clinicId: string;
  search?: string | null;
  includeArchived?: boolean;
}): Prisma.ClientWhereInput {
  const term = args.search?.trim();
  return {
    clinicId: args.clinicId,
    ...(args.includeArchived ? {} : { archivedAt: null }),
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
  };
}

/** Unpaginated list, used for select dropdowns. Caps at `take` rows. */
export async function listClients({
  take = PAGE_SIZES.DROPDOWN,
  ...args
}: ListClientsArgs) {
  return prisma.client.findMany({
    where: buildClientWhere(args),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    include: {
      _count: { select: { pets: { where: { archivedAt: null } } } },
    },
  });
}

export interface PagedClientsArgs extends Omit<ListClientsArgs, "take"> {
  page?: number;
  perPage?: number;
}

/** Paginated list, used by the clients table page. */
export async function listClientsPage({
  page = 1,
  perPage = PAGE_SIZES.DEFAULT,
  ...args
}: PagedClientsArgs) {
  const where = buildClientWhere(args);
  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: { select: { pets: { where: { archivedAt: null } } } },
      },
    }),
    prisma.client.count({ where }),
  ]);
  return { items, total, page, perPage };
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

/** Lightweight matches used by the global command palette. */
export async function quickSearchClients(
  clinicId: string,
  term: string,
  take = PAGE_SIZES.COMMAND_PALETTE,
) {
  if (term.length < 2) return [];
  return prisma.client.findMany({
    where: buildClientWhere({ clinicId, search: term }),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select: { id: true, firstName: true, lastName: true, email: true },
  });
}
