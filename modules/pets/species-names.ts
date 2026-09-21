import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { fold } from "@/lib/search";
import { LANGUAGES } from "@/modules/clients/schema";
import type { Species } from "@/generated/prisma/enums";

/**
 * The locales this map is built from.
 *
 * Exported so a test can hold it against `LANGUAGES`: the imports below
 * are static and cannot be keyed by a runtime list, so adding a third
 * language would silently leave its species names unrecognised -- and
 * the symptom would be a clinic quietly growing a duplicate species,
 * not an error.
 */
export const SPECIES_NAME_LOCALES = [
  "tr",
  "en",
] as const satisfies readonly (typeof LANGUAGES)[number][];

const CATALOGUES = { tr: tr.enum.species, en: en.enum.species };

/**
 * Every built-in species by the name a person would type for it, folded,
 * in every language the product speaks.
 *
 * A vet types "Kedi", not "CAT". Before this, the server compared the
 * typed value against the enum keys, found nothing, and created a
 * clinic-defined species called "Kedi" -- so the animal was stored as
 * `OTHER` with a custom species beside it, and dropped out of every list
 * that groups by `CAT`. The cat was in the building and not in the
 * report.
 *
 * Disabled species are in here too, deliberately. Turning a species off
 * governs what the picker offers, not what exists; an animal on the
 * table is still a cat, and recording it as something else to respect a
 * display setting is a lie in the data.
 *
 * "Other" is left out. It is the absence of an answer rather than a
 * species, and a clinic that types "Diğer" means something the list does
 * not have -- which is exactly the case the custom species path is for.
 */
const BY_FOLDED_NAME: ReadonlyMap<string, Species> = new Map(
  SPECIES_NAME_LOCALES.flatMap((locale) =>
    Object.entries(CATALOGUES[locale])
      .filter(([key]) => key !== "OTHER")
      .map(([key, label]) => [fold(label), key as Species] as const),
  ),
);

/**
 * The built-in species someone meant by what they typed, or null.
 *
 * Folded on both sides, so "kedi", "Kedi" and "KEDİ" are one answer --
 * the same folding the database uses for names
 * (`lib/search.ts`, `scripts/fold-parity.mjs`).
 */
export function builtInSpeciesNamed(raw: string): Species | null {
  return BY_FOLDED_NAME.get(fold(raw.trim())) ?? null;
}
