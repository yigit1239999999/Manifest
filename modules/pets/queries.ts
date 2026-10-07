import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { fold } from "@/lib/search";
import { termWhere } from "@/modules/clients/queries";
import { ownerLabel, petLabel } from "@/lib/pet-label";
import type { Prisma } from "@/generated/prisma/client";
import { currentWeight, type WeightReading } from "./weight";

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

/**
 * When each of these animals was last seen.
 *
 * The vet asked for it on the picker row, and the reason is the one
 * they gave for the whole row: "I have two Pamuks, and I can only tell
 * which one I mean from the owner" -- with the date as the second
 * check. It is deliberately NOT on the list screen and NOT in
 * `petLabel`, whose own note explains why a third part breaks a
 * fifty-row list at 390px.
 *
 * ONE extra query for the whole page of rows, not one per row: a
 * `groupBy` over the ids just fetched, which is what
 * `@@index([clinicId, petId, visitedAt])` is shaped for. A nested
 * `take: 1` per pet reads better and is the N+1 this codebase keeps
 * catching.
 */
async function withLastVisit<T extends { id: string }>(
  clinicId: string,
  pets: T[],
): Promise<(T & { lastVisitAt: Date | null })[]> {
  if (pets.length === 0) return [];
  const groups = await prisma.visit.groupBy({
    by: ["petId"],
    where: { clinicId, petId: { in: pets.map((p) => p.id) }, archivedAt: null },
    _max: { visitedAt: true },
  });
  const seen = new Map(groups.map((g) => [g.petId, g._max.visitedAt ?? null]));
  return pets.map((p) => ({ ...p, lastVisitAt: seen.get(p.id) ?? null }));
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
            // The owner's name, or the owner's number however it was
            // typed: "the cat of 0532 411…" is how a call starts.
            { owner: termWhere(term) },
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
  const items = rows.slice(0, take);
  return {
    items: await withLastVisit(args.clinicId, items),
    hasMore: rows.length > take,
  };
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

/**
 * The latest weighed visit of each of these animals.
 *
 * One query for any number of animals: `distinct` on the pet over rows
 * ordered newest first, which `@@index([clinicId, petId, visitedAt])`
 * serves. A `take: 1` per animal would be the N+1 this file avoids.
 */
export async function latestVisitWeights(
  clinicId: string,
  petIds: readonly string[],
): Promise<Map<string, { weightKg: number | null; visitedAt: Date }>> {
  if (petIds.length === 0) return new Map();
  const rows = await prisma.visit.findMany({
    where: {
      clinicId,
      petId: { in: [...petIds] },
      archivedAt: null,
      weightKg: { not: null },
    },
    orderBy: [{ petId: "asc" }, { visitedAt: "desc" }],
    distinct: ["petId"],
    select: { petId: true, weightKg: true, visitedAt: true },
  });
  return new Map(rows.map((r) => [r.petId, r]));
}

/** `currentWeight` for a list of animals, in one extra query. */
export async function withCurrentWeight<
  T extends { id: string; weightKg: number | null; weightRecordedAt: Date | null },
>(clinicId: string, pets: T[]): Promise<(T & { currentWeight: WeightReading | null })[]> {
  const latest = await latestVisitWeights(
    clinicId,
    pets.map((p) => p.id),
  );
  return pets.map((p) => ({ ...p, currentWeight: currentWeight(p, latest.get(p.id)) }));
}

/**
 * One animal, with its weight derived from the pet form and its latest
 * weighed visit (see `weight.ts`). The two reads run together.
 */
export async function getPetById(clinicId: string, id: string) {
  const [pet, latest] = await Promise.all([
    getPetRow(clinicId, id),
    latestVisitWeights(clinicId, [id]),
  ]);
  if (!pet) return null;
  return { ...pet, currentWeight: currentWeight(pet, latest.get(pet.id)) };
}

async function getPetRow(clinicId: string, id: string) {
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
  /** See `ListPetsArgs.excludeDeceased`. For a picker whose server refuses them. */
  excludeDeceased = false,
) {
  if (term.length < 2) return { items: [], hasMore: false };
  // Reads one row past the cap and throws it away, the same way
  // `listPets` does. That row is the whole answer to "is this all of
  // them": without it a search that returned exactly the cap and a
  // search that returned everything are the same array, and the picker
  // has to guess. It guessed by comparing the length to the cap, which
  // is the same fact written in two places -- and the two disagree the
  // day the cap moves.
  const rows = await prisma.pet.findMany({
    where: buildPetWhere({ clinicId, search: term, ownerId, excludeDeceased }),
    orderBy: { name: "asc" },
    take: take + 1,
    select: {
      id: true,
      name: true,
      species: true,
      customSpecies: { select: { name: true } },
      ownerId: true,
      owner: { select: { firstName: true, lastName: true } },
      // For telling two Zeytins apart in the palette: species, age, owner.
      birthDate: true,
      deceased: true,
    },
  });
  const items = rows.slice(0, take);
  return {
    items: await withLastVisit(clinicId, items),
    hasMore: rows.length > take,
  };
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
    // The owner too, and this is the most load-bearing of the four places
    // the label is built: a picker filled in from a `?petId=` link is the
    // one the vet did not choose. A row they picked themselves they at
    // least read while picking it; a field that arrived already filled
    // reading "Zeytin" is simply believed.
    select: { name: true, owner: { select: { firstName: true, lastName: true } } },
  });
  return pet ? petLabel({ name: pet.name, ownerName: ownerLabel(pet.owner) }) : undefined;
}

/**
 * `getPetLabel`, plus what the examination has to see before it starts:
 * the animal's medical alerts ("Penisilin alerjisi") and its species,
 * which decides what weight is plausible. The same primary key lookup,
 * so a visit opened for a known animal costs no extra round.
 */
export async function getPetForVisit(clinicId: string, id: string) {
  const pet = await prisma.pet.findFirst({
    where: { id, clinicId },
    select: {
      id: true,
      name: true,
      alerts: true,
      species: true,
      owner: { select: { firstName: true, lastName: true } },
    },
  });
  if (!pet) return undefined;
  return {
    id: pet.id,
    label: petLabel({ name: pet.name, ownerName: ownerLabel(pet.owner) }),
    alerts: pet.alerts,
    species: pet.species,
  };
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
