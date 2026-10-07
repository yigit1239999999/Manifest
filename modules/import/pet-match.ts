import { fold } from "@/lib/search";
import type { Sex, Species } from "@/generated/prisma/enums";

/**
 * Which of an owner's animals a row of the file is about -- and refusing to
 * pick when the file cannot say.
 *
 * WHY THIS IS NOT "THE FIRST ONE WITH THAT NAME": an owner with a dog and a
 * cat both called Boncuk is ordinary (a real clinic's file had 68 such
 * pairs), and matching by name alone sent the cat's rabies date to the dog
 * on every re-import. A vaccination on the wrong animal is the worst kind
 * of wrong record: it looks right, and the animal that needed the booster
 * is the one that does not show as due.
 *
 * So the name only nominates. What the file says about the animal decides:
 *
 * - A microchip that agrees settles it. One that disagrees rules it out.
 * - A species that disagrees rules it out: a cat is not the dog.
 * - Sex and birth date that disagree make it DOUBTFUL rather than excluded.
 *   Those are the fields a clinic corrects after an import, so a mismatch
 *   may be a fix rather than a second animal -- and doubt is a question.
 *
 * Exactly one candidate left with nothing against it is a match. Anything
 * else -- two that both fit, or only doubtful ones -- is put to the vet on
 * the review screen. There is no default answer, the same rule as for
 * "is this the same person".
 */

/** An animal the clinic already has, as much of one as matching needs. */
export type KnownPet = {
  id: string;
  name: string;
  species: Species;
  customSpeciesId: string | null;
  sex: Sex;
  birthDate: Date | null;
  microchipId: string | null;
};

/** What the row says about its animal, already read through the vet's tables. */
export type RowFacts = {
  name: string;
  /**
   * The species the FILE gives this row, or null when it gives none. The
   * bulk answer for species-less rows is not evidence: it is a guess about
   * the whole file and must not rule an animal out.
   */
  species:
    | { kind: "builtIn"; key: Species }
    | { kind: "custom"; id: string }
    | { kind: "newCustom" }
    | null;
  sex: Sex | null;
  birthDate: Date | null;
  microchipId: string | null;
};

export type PetMatch =
  | { kind: "match"; petId: string; byChip: boolean }
  | { kind: "new" }
  | { kind: "ask"; candidates: string[] };

const DAY_MS = 86_400_000;

export function normalizeChip(value: string | null | undefined): string | null {
  if (!value) return null;
  const out = value.replace(/[^0-9a-z]/gi, "").toLowerCase();
  return out === "" ? null : out;
}

function speciesConflicts(row: RowFacts["species"], pet: KnownPet): boolean {
  if (!row) return false;
  const petBuiltIn = !pet.customSpeciesId && pet.species !== "OTHER" ? pet.species : null;
  switch (row.kind) {
    case "builtIn":
      // "Other" on either side is an absence of an answer, not a species.
      if (row.key === "OTHER") return false;
      if (pet.customSpeciesId) return true;
      return petBuiltIn !== null && petBuiltIn !== row.key;
    case "custom":
      if (pet.customSpeciesId) return pet.customSpeciesId !== row.id;
      return petBuiltIn !== null;
    case "newCustom":
      // A species the clinic does not have yet cannot be any animal's
      // species on file.
      return petBuiltIn !== null || Boolean(pet.customSpeciesId);
  }
}

/** Disagreements that may be a later correction rather than a second animal. */
function doubtful(row: RowFacts, pet: KnownPet): boolean {
  if (row.sex && row.sex !== "UNKNOWN" && pet.sex !== "UNKNOWN" && row.sex !== pet.sex) return true;
  if (row.birthDate && pet.birthDate) {
    // A day either way: a form that stored local midnight and a file read
    // at UTC midnight are the same birthday.
    if (Math.abs(row.birthDate.getTime() - pet.birthDate.getTime()) > DAY_MS) return true;
  }
  return false;
}

/** Same name, and neither the chip nor the species says otherwise. */
function possibleFor(row: RowFacts, pets: readonly KnownPet[]): KnownPet[] {
  const name = fold(row.name.trim());
  const chip = normalizeChip(row.microchipId);
  return pets.filter((p) => {
    if (fold(p.name.trim()) !== name) return false;
    const petChip = normalizeChip(p.microchipId);
    if (chip && petChip && chip !== petChip) return false;
    return !speciesConflicts(row.species, p);
  });
}

/** One row against one owner's animals. */
export function matchPet(row: RowFacts, pets: readonly KnownPet[]): PetMatch {
  const possible = possibleFor(row, pets);
  if (possible.length === 0) return { kind: "new" };
  const chip = normalizeChip(row.microchipId);

  if (chip) {
    const byChip = possible.filter((p) => normalizeChip(p.microchipId) === chip);
    if (byChip.length === 1) return { kind: "match", petId: byChip[0].id, byChip: true };
  }

  // One candidate and nothing against it. Anything else -- two that fit,
  // or one that fits but for a sex or a birthday -- is the vet's call, even
  // when one of them is very probably it.
  if (possible.length === 1 && !doubtful(row, possible[0])) {
    return { kind: "match", petId: possible[0].id, byChip: false };
  }
  return { kind: "ask", candidates: possible.map((p) => p.id) };
}

/**
 * Every row of one owner at once, so two rows cannot quietly land on the
 * same animal.
 *
 * Two Boncuk rows with no species against two Boncuk animals each "match"
 * either one; taking them in order would be the first-hit defect again with
 * extra steps. A pet claimed by more than one row on anything weaker than
 * its chip turns every one of those rows into a question.
 */
export function matchOwnerPets(
  rows: ReadonlyArray<{ index: number; facts: RowFacts }>,
  pets: readonly KnownPet[],
): Map<number, PetMatch> {
  const out = new Map<number, PetMatch>();
  for (const row of rows) out.set(row.index, matchPet(row.facts, pets));

  const claims = new Map<string, number[]>();
  for (const [index, match] of out) {
    if (match.kind !== "match" || match.byChip) continue;
    const list = claims.get(match.petId) ?? [];
    list.push(index);
    claims.set(match.petId, list);
  }
  for (const [, indexes] of claims) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      const row = rows.find((r) => r.index === index)!;
      out.set(index, { kind: "ask", candidates: possibleFor(row.facts, pets).map((p) => p.id) });
    }
  }
  return out;
}
