import { describe, expect, it } from "vitest";
import { VACCINES } from "./procedures";
import {
  VACCINE_CATALOGUE,
  dosesRemaining,
  vaccineByName,
  vaccinesForSpecies,
} from "./vaccines";

/**
 * The catalogue is data, so these tests hold the RULES that made it data --
 * the three the vet was explicit about, and the one nobody says out loud
 * until a rename has already broken it.
 */

describe("the list carries what the vet said, and only that", () => {
  it("proposes no interval for the one they would not answer", () => {
    // "Burun içi olanı yılda bir yapıyorum ama altı ay diyenler de var, ben
    // karar veremiyorum. Bunun tarihini önermeyin, bana sorun." So the row
    // exists and the date does not.
    const kennelCough = VACCINE_CATALOGUE.find((v) => v.key === "dog.kennelCough");
    expect(kennelCough).toBeDefined();
    expect(kennelCough?.adult).toEqual({ kind: "ask" });
  });

  it("keeps a range a range", () => {
    // "3-4 hafta arayla." 3.5 is a number nobody said, and a single number
    // here would become a single proposed date on screen.
    const core = VACCINE_CATALOGUE.find((v) => v.key === "dog.core");
    expect(core?.series?.between).toEqual({ min: 3, max: 4 });
  });

  it("does not widen a single figure into a range", () => {
    // The cat's first dose was given as eight weeks, flatly. A `max` here
    // would be ours, not theirs.
    const core = VACCINE_CATALOGUE.find((v) => v.key === "cat.core");
    expect(core?.startAt).toEqual({ min: 8 });
  });

  it("leaves out the schedule they named but refused to endorse", () => {
    // "Riskli bölgede 6 ayda bir yapanlar var, o şemayı koymayın."
    const lepto = VACCINE_CATALOGUE.find((v) => v.key === "dog.lepto");
    expect(lepto?.adult).toEqual({ kind: "every", unit: "year", value: 1 });
  });

  it("has nothing for the species they told us to leave out", () => {
    // "Bizde o aşı bulunmuyor ve ben hiç yazmadım. Listeye koymayın."
    // An empty catalogue is not missing support: the name is free text.
    for (const species of ["BIRD", "RABBIT", "RODENT", "HORSE", "CATTLE"]) {
      expect(vaccinesForSpecies(species)).toEqual([]);
    }
    expect(vaccinesForSpecies("DOG").length).toBeGreaterThan(0);
    expect(vaccinesForSpecies("CAT").length).toBeGreaterThan(0);
  });
});

describe("a rename must not cut a clinic off from its own history", () => {
  it("still recognises every name this product has offered before", () => {
    // The suggestion query keys on the written name. Without this, the day
    // the list lands, a clinic that has used the old long name for a year
    // looks like a clinic with no history -- and their measured interval is
    // replaced by ours, silently, which is the worst shape a defect takes.
    for (const written of VACCINES) {
      const dog = vaccineByName("DOG", written);
      const cat = vaccineByName("CAT", written);
      if (!dog && !cat) continue;
      expect(dog ?? cat).toBeTruthy();
    }
    expect(
      vaccineByName("DOG", "Karma - Parvo, Gençlik, Hepatit, Parainfluenza (DHPPi)")?.key,
    ).toBe("dog.core");
    expect(vaccineByName("CAT", "Kedi lösemisi (FeLV)")?.key).toBe("cat.felv");
  });

  it("is a guard for the guard: an unknown name matches nothing", () => {
    // If folding or the alias list broke open, the test above could pass by
    // matching everything.
    expect(vaccineByName("DOG", "Leishmania")).toBeNull();
    expect(vaccineByName("DOG", "")).toBeNull();
  });

  it("folds the Turkish way on both sides", () => {
    expect(vaccineByName("DOG", "KARMA")?.key).toBe("dog.core");
    expect(vaccineByName("CAT", "kuduz")?.key).toBe("cat.rabies");
  });

  it("keeps one word that means two vaccines apart by species", () => {
    // "Karma" is a dog vaccine and a cat vaccine and they are not the same
    // schedule. A species-blind lookup would attach one animal's history to
    // the other's entry.
    expect(vaccineByName("DOG", "Karma")?.key).toBe("dog.core");
    expect(vaccineByName("CAT", "Karma")?.key).toBe("cat.core");
  });
});

describe("how many doses are left", () => {
  it("counts down the series and stops at zero", () => {
    const core = VACCINE_CATALOGUE.find((v) => v.key === "dog.core")!;
    expect(dosesRemaining(core, 0)).toBe(3);
    expect(dosesRemaining(core, 2)).toBe(1);
    expect(dosesRemaining(core, 5)).toBe(0);
  });

  it("says nothing about a vaccine with no series", () => {
    // Null rather than 0: "this vaccine has no starting series" and "the
    // series is finished" are different sentences on screen.
    const rabies = VACCINE_CATALOGUE.find((v) => v.key === "dog.rabies")!;
    expect(dosesRemaining(rabies, 0)).toBeNull();
  });
});
