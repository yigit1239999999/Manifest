import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { fold } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";

export interface ListPetsArgs {
  clinicId: string;
  search?: string | null;
  ownerId?: string | null;
  species?: string | null;
  includeArchived?: boolean;
  /**
   * Leaves out animals that have died.
   *
   * Off by default, and that is not laziness: a visit is routinely
   * written up for an animal that died during it, and its appointments
   * stay on the record. The one place it must be on is a picker whose
   * server will refuse the choice -- a reminder about a dead animal is
   * rejected by `modules/reminders/service.ts`, so offering one walks a
   * vet into a dead end and answers on the field they cannot fix.
   *
   * Per caller rather than global for exactly that reason: "this animal
   * is gone" is true for one purpose and false for the next.
   */
  excludeDeceased?: boolean;
  take?: number;
}

function buildPetWhere(args: {
  clinicId: string;
  search?: string | null;
  ownerId?: string | null;
  species?: string | null;
  includeArchived?: boolean;
  excludeDeceased?: boolean;
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
    ...(args.excludeDeceased ? { deceased: false } : {}),
    ...(args.ownerId ? { ownerId: args.ownerId } : {}),
    ...(args.species ? { species: args.species as never } : {}),
    // Two folded columns, one of them the owner's. See the same change
    // in `modules/clients/queries.ts` for why ILIKE was not enough: the
    // animal's own fields are generated into `searchKey`, and the owner
    // lives in another table, which a generated column cannot reach --
    // so that half goes through the client's key rather than copying a
    // name that changes when somebody marries.
    ...(term
      ? {
          OR: [
            { searchKey: { contains: fold(term) } },
            { owner: { searchKey: { contains: fold(term) } } },
          ],
        }
      : {}),
  };
}

/** See `listClients`: one row past the cap, so the cap can be reported. */
export async function listPets({ take = PAGE_SIZES.DROPDOWN, ...args }: ListPetsArgs) {
  const rows = await prisma.pet.findMany({
    where: buildPetWhere(args),
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
      customSpecies: { select: { id: true, name: true } },
    },
  });
  return { items: rows.slice(0, take), hasMore: rows.length > take };
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
        // The owner's `archivedAt` too: an archived client takes its pets
        // out of the list with it, and the card has to be able to say so
        // rather than look archived for no visible reason.
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            archivedAt: true,
          },
        },
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
  // Annotated rather than inferred from the default: without it the
  // parameter's type is the literal 5 and the picker cannot ask for 20.
  take: number = PAGE_SIZES.COMMAND_PALETTE,
  /**
   * Restricts the answer to one client's animals.
   *
   * A form that has already asked whose animal this is must not offer
   * somebody else's. Without it the animal picker on such a form could
   * not search at all -- the list was narrowed locally and any search
   * would have widened it straight back to the whole clinic -- so the
   * 51st animal of a client was unreachable, which is the same silent
   * absence one step further in.
   */
  ownerId?: string,
) {
  if (term.length < 2) return [];
  return prisma.pet.findMany({
    where: buildPetWhere({ clinicId, search: term, ownerId }),
    orderBy: { name: "asc" },
    take,
    select: {
      id: true,
      name: true,
      species: true,
      ownerId: true,
      owner: { select: { firstName: true, lastName: true } },
    },
  });
}

/**
 * Just enough of one animal to label it in a picker.
 *
 * A picker is handed the clinic's first `DROPDOWN` records, so an id that
 * arrives from somewhere else — `/visits/new?petId=` followed from the
 * animal's own page — may not be among them. Without the name the field
 * renders empty while the hidden input still carries the id, which reads
 * as "nothing is selected" over a form that will happily submit.
 *
 * Two columns and a primary key lookup, run only when such an id is
 * actually present.
 */
export async function getPetLabel(clinicId: string, id: string) {
  const pet = await prisma.pet.findFirst({
    where: { id, clinicId },
    select: { name: true },
  });
  return pet?.name;
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
