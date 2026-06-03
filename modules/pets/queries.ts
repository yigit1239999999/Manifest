import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface ListPetsArgs {
  clinicId: string;
  search?: string | null;
  ownerId?: string | null;
  species?: string | null;
  includeArchived?: boolean;
  take?: number;
}

function buildPetWhere(args: {
  clinicId: string;
  search?: string | null;
  ownerId?: string | null;
  species?: string | null;
  includeArchived?: boolean;
}): Prisma.PetWhereInput {
  const term = args.search?.trim();
  return {
    clinicId: args.clinicId,
    ...(args.includeArchived
      ? {}
      : {
          archivedAt: null,
          // Cascade soft-delete: archived clients drop their pets too.
          owner: { archivedAt: null },
        }),
    ...(args.ownerId ? { ownerId: args.ownerId } : {}),
    ...(args.species ? { species: args.species as never } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { breed: { contains: term, mode: "insensitive" } },
            { microchipId: { contains: term } },
            {
              owner: {
                OR: [
                  { firstName: { contains: term, mode: "insensitive" } },
                  { lastName: { contains: term, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

export async function listPets({ take = 200, ...args }: ListPetsArgs) {
  return prisma.pet.findMany({
    where: buildPetWhere(args),
    orderBy: { createdAt: "desc" },
    take,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export interface PagedPetsArgs extends Omit<ListPetsArgs, "take"> {
  page?: number;
  perPage?: number;
}

export async function listPetsPage({
  page = 1,
  perPage = 24,
  ...args
}: PagedPetsArgs) {
  const where = buildPetWhere(args);
  const [items, total] = await Promise.all([
    prisma.pet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.pet.count({ where }),
  ]);
  return { items, total, page, perPage };
}

export async function getPetById(clinicId: string, id: string) {
  return prisma.pet.findFirst({
    where: { id, clinicId },
    include: {
      owner: true,
      _count: {
        select: {
          visits: true,
          vaccinations: true,
          prescriptions: true,
          treatments: true,
          diagnostics: true,
          notes_rel: true,
          documents: true,
        },
      },
    },
  });
}

export async function countPets(clinicId: string) {
  return prisma.pet.count({
    where: {
      clinicId,
      archivedAt: null,
      owner: { archivedAt: null },
    },
  });
}

export async function quickSearchPets(
  clinicId: string,
  term: string,
  take = 5,
) {
  if (term.length < 2) return [];
  return prisma.pet.findMany({
    where: buildPetWhere({ clinicId, search: term }),
    orderBy: { name: "asc" },
    take,
    select: {
      id: true,
      name: true,
      species: true,
      owner: { select: { firstName: true, lastName: true } },
    },
  });
}
