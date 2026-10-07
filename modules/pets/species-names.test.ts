import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { LANGUAGES } from "@/modules/clients/schema";
import { SPECIES } from "./schema";
import {
  SPECIES_NAME_LOCALES,
  builtInSpeciesNamed,
  hiddenBuiltInSpecies,
  speciesNames,
} from "./species-names";

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

describe("offering a species the clinic switched off", () => {
  const label = (key: string) => tr.enum.species[key as keyof typeof tr.enum.species];
  const note = (species: string) => `${species} yerleşik bir tür.`;
  const hidden = (enabled: readonly string[]) =>
    hiddenBuiltInSpecies(enabled, label as never, note);

  it("lists exactly what is not enabled", () => {
    const keys = hidden(["DOG", "CAT", "OTHER"]).map((s) => s.value);

    expect(keys).not.toContain("DOG");
    expect(keys).not.toContain("CAT");
    expect(keys).toContain("RABBIT");
    expect(keys).toContain("HORSE");
  });

  it("never offers 'other'", () => {
    // Enabled or not, it is the absence of an answer. Offering it as a
    // hidden species would invite someone to pick "not answered" for an
    // animal that is on the table.
    expect(hidden(["DOG"]).map((s) => s.value)).not.toContain("OTHER");
  });

  it("carries both names, so either one can be typed", () => {
    // The reason this is built on the server at all: the browser has
    // one language, and a vet typing "cat" into a Turkish interface is
    // not making a mistake.
    const rabbit = hidden(["DOG"]).find((s) => s.value === "RABBIT")!;

    expect(rabbit.names).toEqual(expect.arrayContaining(["Tavşan", "Rabbit"]));
    expect(rabbit.label).toBe("Tavşan");
    expect(rabbit.note).toContain("Tavşan");
  });

  it("does not repeat a name two languages share", () => {
    // "Hamster"-shaped cases: one word in both catalogues, and a
    // duplicate in the list is a duplicate comparison forever.
    for (const s of hidden([])) {
      expect(new Set(s.names).size).toBe(s.names.length);
    }
    expect(speciesNames("CAT")).toEqual(["Kedi", "Cat"]);
  });
});
