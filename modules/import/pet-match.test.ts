import { describe, expect, it } from "vitest";
import { matchOwnerPets, matchPet, type KnownPet, type RowFacts } from "./pet-match";

const pet = (over: Partial<KnownPet>): KnownPet => ({
  id: "p",
  name: "Boncuk",
  species: "DOG",
  customSpeciesId: null,
  sex: "UNKNOWN",
  birthDate: null,
  microchipId: null,
  ...over,
});

const row = (over: Partial<RowFacts>): RowFacts => ({
  name: "Boncuk",
  species: null,
  sex: null,
  birthDate: null,
  microchipId: null,
  ...over,
});

const dog = pet({ id: "dog", species: "DOG" });
const cat = pet({ id: "cat", species: "CAT" });

describe("matching a row to one of the owner's animals", () => {
  it("tells two Boncuks apart by species", () => {
    expect(matchPet(row({ species: { kind: "builtIn", key: "CAT" } }), [dog, cat])).toEqual({
      kind: "match",
      petId: "cat",
      byChip: false,
    });
    expect(matchPet(row({ species: { kind: "builtIn", key: "DOG" } }), [dog, cat])).toMatchObject({
      petId: "dog",
    });
  });

  it("asks rather than taking the first when nothing tells them apart", () => {
    expect(matchPet(row({}), [dog, cat])).toEqual({ kind: "ask", candidates: ["dog", "cat"] });
  });

  it("reads a different species as a different animal, not as this one", () => {
    expect(matchPet(row({ species: { kind: "builtIn", key: "CAT" } }), [dog])).toEqual({ kind: "new" });
  });

  it("settles on a chip, and a chip that disagrees rules the animal out", () => {
    const a = pet({ id: "a", species: "CAT", microchipId: "900 1234" });
    const b = pet({ id: "b", species: "CAT", microchipId: "900 9999" });
    expect(matchPet(row({ microchipId: "9001234" }), [a, b])).toEqual({ kind: "match", petId: "a", byChip: true });
    expect(matchPet(row({ microchipId: "111" }), [a])).toEqual({ kind: "new" });
  });

  it("asks when only a sex or a birthday disagrees, since those get corrected", () => {
    const female = pet({ id: "f", sex: "FEMALE", birthDate: new Date("2020-05-01T00:00:00Z") });
    expect(matchPet(row({ sex: "MALE" }), [female])).toEqual({ kind: "ask", candidates: ["f"] });
    expect(matchPet(row({ birthDate: new Date("2021-05-01T00:00:00Z") }), [female])).toEqual({
      kind: "ask",
      candidates: ["f"],
    });
    // A day either way is the same birthday stored at a different midnight.
    expect(matchPet(row({ birthDate: new Date("2020-04-30T21:00:00Z") }), [female])).toMatchObject({
      kind: "match",
      petId: "f",
    });
  });

  it("is accent- and case-blind on the name, and new when no animal has it", () => {
    expect(matchPet(row({ name: "BONCUK " }), [dog])).toMatchObject({ kind: "match", petId: "dog" });
    expect(matchPet(row({ name: "Pamuk" }), [dog])).toEqual({ kind: "new" });
  });

  it("never lets two rows land on one animal on a name alone", () => {
    const result = matchOwnerPets(
      [
        { index: 1, facts: row({}) },
        { index: 2, facts: row({}) },
      ],
      [dog],
    );
    expect(result.get(1)).toEqual({ kind: "ask", candidates: ["dog"] });
    expect(result.get(2)).toEqual({ kind: "ask", candidates: ["dog"] });
  });

  it("places both rows of a dog-and-cat pair on their own animals", () => {
    const result = matchOwnerPets(
      [
        { index: 1, facts: row({ species: { kind: "builtIn", key: "DOG" } }) },
        { index: 2, facts: row({ species: { kind: "builtIn", key: "CAT" } }) },
      ],
      [dog, cat],
    );
    expect(result.get(1)).toMatchObject({ kind: "match", petId: "dog" });
    expect(result.get(2)).toMatchObject({ kind: "match", petId: "cat" });
  });
});
