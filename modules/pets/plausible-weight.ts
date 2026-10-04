import { parseDecimal } from "@/lib/forms";
import type { SPECIES } from "./schema";

/**
 * The heaviest an animal of each kind is likely to be on the scale, in kg.
 *
 * Generous on purpose: a Maine Coon or a giant breed is not a typo, and a
 * warning that fires on real animals teaches the vet to stop reading it.
 * What this catches is the wrong unit or a slipped decimal -- a cat saved
 * at 42 kg because "4,2" lost its comma. Species with no row are not
 * checked: a horse or a fish spans too wide a range for one number.
 */
export const PLAUSIBLE_MAX_KG = {
  CAT: 15,
  DOG: 100,
  RABBIT: 10,
  BIRD: 2,
  RODENT: 3,
  FERRET: 3,
  REPTILE: 50,
} as const satisfies Partial<Record<(typeof SPECIES)[number], number>>;

export type WeightCheckedSpecies = keyof typeof PLAUSIBLE_MAX_KG;

/**
 * The typed weight, when it is above what this species plausibly weighs;
 * null otherwise -- including when the box is empty or not yet a number,
 * which the schema answers on submit. Never a reason to refuse the save.
 */
export function implausibleWeight(
  species: string | null | undefined,
  typed: string,
): { species: WeightCheckedSpecies; kg: number } | null {
  if (!species || !Object.hasOwn(PLAUSIBLE_MAX_KG, species)) return null;
  const key = species as WeightCheckedSpecies;
  const text = typed.trim();
  if (!text) return null;
  const kg = parseDecimal(text);
  if (!Number.isFinite(kg) || kg <= PLAUSIBLE_MAX_KG[key]) return null;
  return { species: key, kg };
}
