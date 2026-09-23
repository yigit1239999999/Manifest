import { describe, expect, it } from "vitest";
import { applySpecies, proposeSex, proposeSpecies, type SpeciesProposal } from "./enum-map";

/**
 * Fixtures build a MECHANISM. "A value the product cannot read becomes a
 * question rather than a guess" holds for any file; none of these values
 * claims to be what a real clinic writes in its species column.
 */

const table = (proposals: SpeciesProposal[]) => new Map(proposals.map((p) => [p.raw, p]));

describe("what a species cell means", () => {
  it("reads the product's own species names, in either language", () => {
    const [tr] = proposeSpecies(["Kedi"], []);
    const [en] = proposeSpecies(["Cat"], []);
    expect(tr.target).toEqual({ kind: "builtIn", key: "CAT" });
    expect(en.target).toEqual({ kind: "builtIn", key: "CAT" });
  });

  it("counts the rows behind each line, so one answer shows its weight", () => {
    const [only] = proposeSpecies(["Kedi", "kedi", "KEDİ"], []);
    // Distinct by the value as typed, because that is what the vet is
    // shown; the three spellings are three lines with the same answer,
    // and collapsing them would show a value nobody's file contains.
    expect(proposeSpecies(["Kedi", "Kedi"], [])).toHaveLength(1);
    expect(only.rows).toBeGreaterThan(0);
  });

  it("proposes the split when one cell holds the animal and its breed", () => {
    const [both] = proposeSpecies(["Tekir Kedi"], []);
    expect(both.target).toEqual({ kind: "builtIn", key: "CAT" });
    expect(both.breed).toBe("Tekir");
    expect(both.settled).toBe(true);
  });

  it("tries the whole value before it tries splitting it", () => {
    // "Van Kedisi" is a breed whose last word is a species name. Splitting
    // first would be right here by luck and wrong on everything that is not
    // a species name with a word in front of it.
    const [whole] = proposeSpecies(["Kedi"], []);
    expect(whole.breed).toBeUndefined();
  });

  it("uses a species this clinic has already defined", () => {
    const [known] = proposeSpecies(["Kirpi"], [{ id: "s1", name: "Kirpi" }]);
    expect(known.target).toEqual({ kind: "custom", id: "s1" });
  });

  it("offers a species of their own rather than throwing the word away", () => {
    // The alternative is OTHER with the name lost, which is the defect
    // `species-names.ts` was written to close on the pet form.
    const [unknown] = proposeSpecies(["Sugar glider"], []);
    expect(unknown.target).toEqual({ kind: "newCustom", name: "Sugar glider" });
    expect(unknown.settled).toBe(true);
  });

  it("lets a breed column win over the breed read out of a species cell", () => {
    // A file with both columns has already answered; replacing that with
    // half of another cell would swap a fact for an inference.
    const proposals = proposeSpecies(["Tekir Kedi"], []);
    expect(applySpecies("Tekir Kedi", "Van Kedisi", table(proposals)).breed).toBe("Van Kedisi");
    expect(applySpecies("Tekir Kedi", null, table(proposals)).breed).toBe("Tekir");
  });

  it("asks when the column was never mapped", () => {
    expect(applySpecies(null, null, new Map()).target).toEqual({ kind: "unknown" });
  });
});

describe("what a sex cell means", () => {
  it("reads the product's own labels in either language", () => {
    expect(proposeSex(["Erkek"])[0].target).toBe("MALE");
    expect(proposeSex(["Dişi"])[0].target).toBe("FEMALE");
    expect(proposeSex(["Female"])[0].target).toBe("FEMALE");
  });

  it("refuses an abbreviation that means different things in different clinics", () => {
    // "K" is the first letter of a female dog in one file and of a breed in
    // another. One line the vet answers once, rather than a guess applied
    // to every row that carries it.
    const [k] = proposeSex(["K"]);
    expect(k.target).toBeNull();
    expect(k.settled).toBe(false);
  });

  it("shows every distinct value, including the ones it is sure about", () => {
    // The rule the task states: no silent "Erkek" -> MALE. Being sure is
    // not the same as being allowed to decide out of sight, so a settled
    // value is still a line on the table.
    const proposals = proposeSex(["Erkek", "Erkek", "K"]);
    expect(proposals.map((p) => p.raw)).toEqual(["Erkek", "K"]);
    expect(proposals[0].settled).toBe(true);
  });
});
