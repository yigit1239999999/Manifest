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

/**
 * Unpaginated list for select dropdowns, and whether there are more.
 *
 * Reads one row past the cap and throws it away. That one row is the
 * whole point: without it the list is indistinguishable from a complete
 * one, and a clinic past the cap is told nothing while its last hundred
 * clients quietly cannot be chosen.
 */
export async function listClients({
  take = PAGE_SIZES.DROPDOWN,
  ...args
}: ListClientsArgs) {
  const rows = await prisma.client.findMany({
    where: buildClientWhere(args),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: take + 1,
    include: {
      _count: { select: { pets: { where: { archivedAt: null } } } },
    },
  });
  return { items: rows.slice(0, take), hasMore: rows.length > take };
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
        include: { customSpecies: { select: { name: true } } },
      },
      _count: { select: { visits: true, appointments: true, invoices: true } },
    },
  });
}

/**
 * Just enough of one client to label it in a picker. See `getPetLabel`
 * in `modules/pets/queries.ts` for why a picker needs this at all.
 */
export async function getClientLabel(clinicId: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, clinicId },
    select: { firstName: true, lastName: true },
  });
  return client ? `${client.firstName} ${client.lastName}` : undefined;
}

export async function countClients(clinicId: string) {
  return prisma.client.count({ where: { clinicId, archivedAt: null } });
}

/**
 * Lightweight matches, used by the global command palette and — with a
 * larger `take` — by the pickers on the forms.
 *
 * The second caller is why the cap is a parameter rather than a constant
 * here: the palette wants five, a picker wants a screenful. Both want the
 * same query, and writing it twice is how the two would start disagreeing
 * about what "matches" means.
 */
export async function quickSearchClients(
  clinicId: string,
  term: string,
  // Annotated rather than inferred from the default: without it the
  // parameter's type is the literal 5 and the picker cannot ask for 20.
  take: number = PAGE_SIZES.COMMAND_PALETTE,
) {
  if (term.length < 2) return [];
  return prisma.client.findMany({
    where: buildClientWhere({ clinicId, search: term }),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select: { id: true, firstName: true, lastName: true, email: true },
  });
}
