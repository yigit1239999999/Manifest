import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
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

export async function listPets({ take = PAGE_SIZES.DROPDOWN, ...args }: ListPetsArgs) {
  return prisma.pet.findMany({
    where: buildPetWhere(args),
    orderBy: { createdAt: "desc" },
    take,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
      customSpecies: { select: { id: true, name: true } },
    },
  });
}

export interface PagedPetsArgs extends Omit<ListPetsArgs, "take"> {
  page?: number;
  perPage?: number;
}

export async function listPetsPage({
  page = 1,
  perPage = PAGE_SIZES.PETS,
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
        customSpecies: { select: { id: true, name: true } },
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
      customSpecies: { select: { id: true, name: true } },
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
  take = PAGE_SIZES.COMMAND_PALETTE,
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

/** Clinic-defined species, alphabetical — feeds the species combobox. */
export async function listCustomSpecies(clinicId: string) {
  return prisma.customSpecies.findMany({
    where: { clinicId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Distinct breeds this clinic has already used, keyed by species
 * ("DOG" | ... | "custom:<id>"). Merged into the breed combobox so the
 * clinic's own world grows with every pet they register.
 */
export async function listClinicBreedOptions(clinicId: string) {
  const rows = await prisma.pet.findMany({
    where: { clinicId, breed: { not: null } },
    select: { breed: true, species: true, customSpeciesId: true },
    distinct: ["breed", "species", "customSpeciesId"],
    take: 1000,
  });
  return rows
    .filter((r) => r.breed && r.breed.trim().length > 0)
    .map((r) => ({
      speciesKey: r.customSpeciesId ? `custom:${r.customSpeciesId}` : r.species,
      breed: r.breed as string,
    }));
}
