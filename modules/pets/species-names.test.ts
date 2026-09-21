import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { LANGUAGES } from "@/modules/clients/schema";
import { SPECIES } from "./schema";
import { SPECIES_NAME_LOCALES, builtInSpeciesNamed } from "./species-names";

describe("recognising a built-in species by the name a person types", () => {
  it("covers every language the product speaks", () => {
    // The imports in `species-names.ts` are static and cannot be keyed
    // by a runtime list, so a third language would leave its species
    // names unrecognised. The symptom would not be an error: it would
    // be that clinic quietly growing a duplicate species, which is the
    // defect this file exists to prevent, returned by the back door.
    expect([...SPECIES_NAME_LOCALES]).toEqual([...LANGUAGES]);
  });

  it("knows every built-in species by both of its names", () => {
    // Asserted over the enum rather than over a list written here: a
    // species added to `SPECIES` without a translation, or with one
    // this map cannot reach, fails immediately instead of the first
    // time a vet types it.
    for (const key of SPECIES) {
      if (key === "OTHER") continue;
      expect(builtInSpeciesNamed(tr.enum.species[key])).toBe(key);
      expect(builtInSpeciesNamed(en.enum.species[key])).toBe(key);
    }
  });

  it("does not care how the name was typed", () => {
    expect(builtInSpeciesNamed("kedi")).toBe("CAT");
    expect(builtInSpeciesNamed("KEDİ")).toBe("CAT");
    expect(builtInSpeciesNamed("  Kopek ")).toBe("DOG");
    expect(builtInSpeciesNamed("Tavsan")).toBe("RABBIT");
  });

  it("leaves 'other' to the clinic-defined path", () => {
    // Not a species: it is the absence of an answer. A clinic typing
    // "Diğer" means something the list does not have, which is exactly
    // what a clinic-defined species is for.
    expect(builtInSpeciesNamed("Diğer")).toBeNull();
    expect(builtInSpeciesNamed("Other")).toBeNull();
  });

  it("says no to a name that is genuinely not a built-in", () => {
    // The guard against over-matching. A lookup that answered here
    // would close the clinic-defined species feature while looking
    // like a bug fix.
    expect(builtInSpeciesNamed("Kirpi")).toBeNull();
    expect(builtInSpeciesNamed("")).toBeNull();
  });
});
