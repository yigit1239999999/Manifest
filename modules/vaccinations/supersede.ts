import { prisma } from "@/lib/prisma";
import { fold } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";
import {
  clinicVaccineList,
  looseVaccineName,
  normalizeVaccineSettings,
  offerByName,
  type VaccineOffer,
} from "./catalogue";

/**
 * Which vaccination answers which, for one animal's rows.
 *
 * Rows are grouped by vaccine -- the catalogue offer a name belongs to,
 * through every alias, or the name itself folded and loosened when it is
 * not on the list -- and within a group each row points at the next newer
 * one. The newest points at nothing: its date is the one still open.
 *
 * Pure, so the rule can be tested without a database. Returns only the
 * rows whose value has to change.
 */
export function supersessionChanges(
  rows: readonly {
    id: string;
    name: string;
    administeredAt: Date;
    supersededById: string | null;
  }[],
  offers: readonly VaccineOffer[],
): Map<string, string | null> {
  const groups = new Map<string, typeof rows[number][]>();
  for (const row of rows) {
    const key =
      offerByName(offers, row.name)?.key ?? `name:${looseVaccineName(fold(row.name.trim()))}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const changes = new Map<string, string | null>();
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        a.administeredAt.getTime() - b.administeredAt.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    group.forEach((row, i) => {
      const next = group[i + 1]?.id ?? null;
      if (row.supersededById !== next) changes.set(row.id, next);
    });
  }
  return changes;
}

type Db = Pick<Prisma.TransactionClient, "vaccination" | "pet" | "clinic">;

/**
 * Brings `supersededById` up to date for these animals.
 *
 * Called after every vaccination write and removal. Three reads (the
 * clinic's list settings, the animals' species, their vaccinations) and
 * one update per distinct target, whatever the number of animals -- the
 * import calls it for a whole file at once.
 *
 * Hidden vaccines still count: hiding governs what the picker offers, and
 * a dose given under a hidden name is still a dose.
 */
export async function recomputeSuperseded(
  clinicId: string,
  petIds: readonly string[],
  db: Db = prisma,
): Promise<void> {
  const ids = [...new Set(petIds)];
  if (ids.length === 0) return;
  const [clinic, pets, rows] = await Promise.all([
    db.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } }),
    db.pet.findMany({
      where: { clinicId, id: { in: ids } },
      select: { id: true, species: true },
    }),
    db.vaccination.findMany({
      where: { clinicId, petId: { in: ids } },
      select: { id: true, petId: true, name: true, administeredAt: true, supersededById: true },
    }),
  ]);
  const settings = {
    ...normalizeVaccineSettings(
      ((clinic?.settings ?? {}) as { vaccines?: unknown }).vaccines,
    ),
    hidden: [],
  };

  const offersBySpecies = new Map<string, VaccineOffer[]>();
  const speciesOf = new Map(pets.map((p) => [p.id, p.species as string]));
  const byPet = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPet.get(row.petId) ?? [];
    list.push(row);
    byPet.set(row.petId, list);
  }

  // Grouped by target so an import of a thousand rows is a handful of
  // statements, not a thousand.
  const byTarget = new Map<string | null, string[]>();
  for (const [petId, list] of byPet) {
    const species = speciesOf.get(petId) ?? "OTHER";
    let offers = offersBySpecies.get(species);
    if (!offers) {
      offers = clinicVaccineList(species, settings);
      offersBySpecies.set(species, offers);
    }
    for (const [id, target] of supersessionChanges(list, offers)) {
      const bucket = byTarget.get(target) ?? [];
      bucket.push(id);
      byTarget.set(target, bucket);
    }
  }
  for (const [target, rowIds] of byTarget) {
    await db.vaccination.updateMany({
      where: { clinicId, id: { in: rowIds } },
      data: { supersededById: target },
    });
  }
}
