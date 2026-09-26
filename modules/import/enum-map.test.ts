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

describe("one answer for the rows the file says nothing about (#42)", () => {
  it("still asks when no answer was given", () => {
    // The whole of "proposes, does not decide": no fallback is the ordinary
    // case and behaves exactly as it did before the fallback existed.
    expect(applySpecies(null, null, new Map(), null).target).toEqual({ kind: "unknown" });
  });

  it("gives the vet's answer to every row with no species of its own", () => {
    expect(applySpecies(null, null, new Map(), { kind: "builtIn", key: "CAT" })).toEqual({
      target: { kind: "builtIn", key: "CAT" },
      breed: null,
    });
  });

  it("keeps OTHER as an answer somebody chose, not one nobody was asked for", () => {
    // The defect this closes was never OTHER; it was OTHER arriving without
    // the question. A mixed file's vet picks it on purpose, and the record
    // cannot tell the two apart -- only this call can.
    expect(applySpecies(null, null, new Map(), { kind: "builtIn", key: "OTHER" }).target).toEqual({
      kind: "builtIn",
      key: "OTHER",
    });
  });

  it("answers a clinic's own species too", () => {
    expect(applySpecies(null, null, new Map(), { kind: "custom", id: "s1" }).target).toEqual({
      kind: "custom",
      id: "s1",
    });
  });

  it("never overrules a value the file DOES carry", () => {
    // The question was "what are the ones you did not say", and a row that
    // says "Kedi" said something. A bulk answer that reached these rows
    // would be the product deciding, one screen later.
    const proposals = proposeSpecies(["Kopek"], []);
    const answer = applySpecies("Kopek", null, table(proposals), { kind: "builtIn", key: "CAT" });
    expect(answer.target).toEqual({ kind: "builtIn", key: "DOG" });
  });

  it("leaves a breed the file gave alone", () => {
    expect(applySpecies(null, "Tekir", new Map(), { kind: "builtIn", key: "CAT" }).breed).toBe(
      "Tekir",
    );
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
