import { fold } from "@/lib/search";
import { SPECIES } from "@/modules/pets/schema";
import { builtInSpeciesNamed } from "@/modules/pets/species-names";
import trMessages from "@/messages/tr.json";
import enMessages from "@/messages/en.json";
import type { Sex, Species } from "@/generated/prisma/enums";

/**
 * What the file calls a species or a sex, and what this product calls it --
 * shown as a list the vet can change, never applied behind their back.
 *
 * The rule the task states and this file exists to keep: there is no silent
 * "Erkek" -> MALE. Not because the translation is wrong, but because the
 * vet has to be able to SEE the whole translation table before two thousand
 * animals are written with it. One clinic's "K" means kangal and another's
 * means female; the only safe version of that knowledge is the one on
 * screen, with the count of rows each line will decide.
 *
 * So every distinct value gets a row here, including the ones we are sure
 * about. `settled` says whether the product had an answer, not whether the
 * vet is allowed to change it -- they always are.
 */

export type SpeciesTarget =
  /** One of the built-in species. */
  | { kind: "builtIn"; key: Species }
  /** A species this clinic has already defined. */
  | { kind: "custom"; id: string }
  /** A species this clinic does not have yet, created on commit under this name. */
  | { kind: "newCustom"; name: string }
  /** Nothing in the value says what animal this is. The vet answers. */
  | { kind: "unknown" };

export type SpeciesProposal = {
  /** The value exactly as the file has it, which is what the vet recognises. */
  raw: string;
  target: SpeciesTarget;
  /**
   * What this value also says about the breed, when it carried both --
   * "Tekir Kedi" is a cat called a tabby, and the breed half would be lost
   * if only the species were read out of it.
   *
   * A PROPOSAL. It is filled in and shown, and the vet can empty it; the
   * one thing it never does is overwrite a breed column the file already
   * has (see `applySpecies`).
   */
  breed?: string;
  /** How many body rows carry this value. The weight behind one line. */
  rows: number;
  settled: boolean;
};

/** A species this clinic has defined for itself. */
export type CustomSpeciesOption = { id: string; name: string };

/** Separators a clinic writes between a species and a breed in one cell. */
const SPLIT = /[\s/,\-()]+/;

/**
 * What one species cell means: the animal, and the breed if the cell held
 * both.
 *
 * Read in three passes, widest evidence first. The whole value is tried
 * before any splitting, because "Akbas" is a dog breed and "Van Kedisi" is a
 * cat breed, and a splitter that runs first would happily read the word
 * "Kedisi" out of the second one and call the rest a breed -- which is the
 * right answer by luck rather than by reading, and is the wrong answer on
 * anything that does not end in a species name.
 *
 * When nothing in the cell names an animal, the product does NOT guess. The
 * whole value is offered as the breed (because it plainly says something
 * about the animal) and the species becomes a question. That is the case
 * the task names: if it cannot be split, everything goes to the breed and
 * the species is asked for.
 */
export function readSpeciesCell(
  raw: string,
  custom: readonly CustomSpeciesOption[],
): { target: SpeciesTarget; breed?: string } {
  const value = raw.trim();
  if (value === "") return { target: { kind: "unknown" } };

  const whole = builtInSpeciesNamed(value);
  if (whole) return { target: { kind: "builtIn", key: whole } };

  const folded = fold(value);
  const known = custom.find((c) => fold(c.name) === folded);
  if (known) return { target: { kind: "custom", id: known.id } };

  const parts = value.split(SPLIT).filter((p) => p !== "");
  for (let i = 0; i < parts.length; i += 1) {
    const species = builtInSpeciesNamed(parts[i]);
    if (!species) continue;
    const rest = parts.filter((_, j) => j !== i).join(" ").trim();
    return {
      target: { kind: "builtIn", key: species },
      breed: rest === "" ? undefined : rest,
    };
  }

  // A word this clinic uses for an animal we do not know: "Kirpi", "Sugar
  // glider". Offered as a species of their own rather than as OTHER with the
  // name thrown away -- the same thing the pet form does when a vet types a
  // species that is not in the list.
  return { target: { kind: "newCustom", name: value }, breed: undefined };
}

/**
 * Every distinct species value in the column, with what it will become.
 *
 * Distinct rather than per row: a file of two thousand animals has perhaps
 * eight species, and eight lines is a table a vet reads. Two thousand is a
 * wall they scroll past, which is the same as not showing it.
 */
export function proposeSpecies(
  values: readonly string[],
  custom: readonly CustomSpeciesOption[],
): SpeciesProposal[] {
  const counts = countDistinct(values);
  return [...counts.entries()].map(([raw, rows]) => {
    const read = readSpeciesCell(raw, custom);
    return {
      raw,
      target: read.target,
      breed: read.breed,
      rows,
      // A value we could not read at all is the only unsettled one. A split
      // is settled AND shown: the vet sees "Tekir Kedi -> Kedi, irk Tekir"
      // and can take the breed back off, which is what "proposed, not
      // imposed" means in a screen rather than in a sentence.
      settled: read.target.kind !== "unknown",
    };
  });
}

/**
 * Sex values we are prepared to read without asking, folded.
 *
 * Built from the product's own catalogues in both languages, the way
 * `species-names.ts` does it, plus the abbreviations a clinic's file
 * actually carries.
 *
 * WHAT IS DELIBERATELY NOT IN HERE: a bare "K". It is the first letter of
 * "kanci" (a female dog) in one file and of "Kangal" in another, and one
 * clinic's abbreviation is not evidence about the next clinic's. An unlisted value is not a
 * failure -- it becomes one line the vet answers once, and every row with
 * that value follows the answer.
 */
const SEX_CATALOGUES = { tr: trMessages.enum.sex, en: enMessages.enum.sex };

const SEX_BY_VALUE: ReadonlyMap<string, Sex> = new Map([
  ...(["tr", "en"] as const).flatMap((locale) =>
    Object.entries(SEX_CATALOGUES[locale]).map(
      ([key, label]) => [fold(label), key as Sex] as const,
    ),
  ),
  ["e", "MALE"] as const,
  ["m", "MALE"] as const,
  ["d", "FEMALE"] as const,
  ["f", "FEMALE"] as const,
  ["disi", "FEMALE"] as const,
  ["?", "UNKNOWN"] as const,
  ["-", "UNKNOWN"] as const,
]);

export type SexProposal = {
  raw: string;
  /** Null means the product has no reading of this value. The vet gives one. */
  target: Sex | null;
  rows: number;
  settled: boolean;
};

export function proposeSex(values: readonly string[]): SexProposal[] {
  const counts = countDistinct(values);
  return [...counts.entries()].map(([raw, rows]) => {
    const target = SEX_BY_VALUE.get(fold(raw)) ?? null;
    return { raw, target, rows, settled: target !== null };
  });
}

function countDistinct(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (key === "") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** The built-in species keys, for the picker beside every unsettled line. */
export const SPECIES_KEYS: readonly Species[] = SPECIES as readonly Species[];

/**
 * The species half of a pet row, given the vet's answered table.
 *
 * `breedFromColumn` is what a mapped breed COLUMN said, and it wins over
 * the breed read out of the species cell. A file with both columns has
 * already answered the question; overwriting it with half of another cell
 * would replace a fact with an inference.
 */
export function applySpecies(
  raw: string | null,
  breedFromColumn: string | null,
  table: ReadonlyMap<string, SpeciesProposal>,
): { target: SpeciesTarget; breed: string | null } {
  if (!raw) return { target: { kind: "unknown" }, breed: breedFromColumn };
  const answer = table.get(raw.trim());
  if (!answer) return { target: { kind: "unknown" }, breed: breedFromColumn };
  return { target: answer.target, breed: breedFromColumn ?? answer.breed ?? null };
}
