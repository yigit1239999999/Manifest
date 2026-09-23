import { describe, expect, it } from "vitest";
import type { IntervalSuggestion } from "@/lib/vaccination-interval";
import {
  clinicVaccineList,
  normalizeVaccineSettings,
  offerByName,
  type VaccineSettings,
} from "./catalogue";

const EMPTY: VaccineSettings = { hidden: [], intervals: {}, added: [] };

/**
 * What `vaccinationIntervalSuggestions` hands back: keys are FOLDED names
 * ("kopek oksurugu", not "köpek öksürüğü"), because that is the one form
 * both sides of this feature agree on.
 */
const history = (entries: Record<string, [IntervalSuggestion["unit"], number, number]>) =>
  Object.fromEntries(
    Object.entries(entries).map(([name, [unit, value, sampleSize]]) => [
      name,
      { unit, value, sampleSize },
    ]),
  ) as Record<string, IntervalSuggestion>;

const find = (offers: ReturnType<typeof clinicVaccineList>, key: string) =>
  offers.find((o) => o.key === key);

describe("whose number the screen shows", () => {
  it("shows ours when the clinic has no records", () => {
    const core = find(clinicVaccineList("DOG", EMPTY), "dog.core");
    expect(core?.due).toEqual({ kind: "list", interval: { unit: "year", value: 1 } });
  });

  it("prefers what the clinic has actually done", () => {
    // The task's rule, stated plainly: a clinic that has written "Kuduz 400
    // gün" repeatedly gets 400, not our 365. Ours is a default; theirs is a
    // measurement of them.
    const offers = clinicVaccineList("DOG", EMPTY, history({ kuduz: ["month", 13, 4] }));
    expect(find(offers, "dog.rabies")?.due).toEqual({
      kind: "history",
      interval: { unit: "month", value: 13 },
      sampleSize: 4,
    });
  });

  it("finds that history under the name the clinic used to write", () => {
    // The rename is the trap: their year of records says "Karma - Parvo,
    // Gençlik, Hepatit, Parainfluenza (DHPPi)". Miss this and the day the
    // list lands their own measured interval is replaced by ours, silently.
    const offers = clinicVaccineList(
      "DOG",
      EMPTY,
      history({
        "karma - parvo, genclik, hepatit, parainfluenza (dhppi)": ["month", 14, 6],
      }),
    );
    expect(find(offers, "dog.core")?.due).toMatchObject({ kind: "history" });
  });

  it("lets the clinic overrule both by saying so", () => {
    // Saying it is stronger evidence than doing it, and a vet who types a
    // number has already been shown their own habit.
    const settings: VaccineSettings = {
      ...EMPTY,
      intervals: { "dog.rabies": { unit: "year", value: 2 } },
    };
    const offers = clinicVaccineList("DOG", settings, history({ kuduz: ["month", 13, 9] }));
    expect(find(offers, "dog.rabies")?.due).toEqual({
      kind: "clinic",
      interval: { unit: "year", value: 2 },
    });
  });
});

describe("the vaccine we refuse to date", () => {
  it("is on the list, with no number and no silence", () => {
    // "Bunun tarihini önermeyin, bana sorun." `ask` is an answer the screen
    // renders, not an absence it skips.
    const offers = clinicVaccineList("DOG", EMPTY);
    expect(find(offers, "dog.kennelCough")?.due).toEqual({ kind: "ask" });
  });

  it("stops being a question once the clinic's own records answer it", () => {
    // "Ask" means WE cannot say. A clinic that has given it at the same
    // interval four times has said something, and their answer stands.
    const offers = clinicVaccineList(
      "DOG",
      EMPTY,
      history({ "kopek oksurugu": ["year", 1, 4] }),
    );
    expect(find(offers, "dog.kennelCough")?.due).toMatchObject({ kind: "history" });
  });
});

describe("the clinic's own list", () => {
  it("takes an entry off when the clinic hides it", () => {
    // ŞART C: "Ben köpek öksürüğünü çoğu hastada hiç yazmıyorum, listede hep
    // durursa gözümü yorar."
    const offers = clinicVaccineList("DOG", { ...EMPTY, hidden: ["dog.kennelCough"] });
    expect(find(offers, "dog.kennelCough")).toBeUndefined();
    expect(find(offers, "dog.core")).toBeDefined();
  });

  it("adds one of their own, and says nothing about its interval", () => {
    // Not `ask`: that is the list admitting to a question it knows about.
    // Nobody has asked anything about a vaccine the clinic just typed in.
    const offers = clinicVaccineList("DOG", {
      ...EMPTY,
      added: [{ species: "DOG", name: "Leishmania" }],
    });
    const own = find(offers, "clinic:leishmania");
    expect(own?.name).toBe("Leishmania");
    expect(own?.due).toEqual({ kind: "none" });
  });

  it("lets their own entry learn from their own records", () => {
    const offers = clinicVaccineList(
      "DOG",
      { ...EMPTY, added: [{ species: "DOG", name: "Leishmania" }] },
      history({ leishmania: ["year", 1, 3] }),
    );
    expect(find(offers, "clinic:leishmania")?.due).toMatchObject({ kind: "history" });
  });

  it("keeps a clinic's dog entry out of its cat list", () => {
    const offers = clinicVaccineList("CAT", {
      ...EMPTY,
      added: [{ species: "DOG", name: "Leishmania" }],
    });
    expect(find(offers, "clinic:leishmania")).toBeUndefined();
  });
});

describe("reading the settings block", () => {
  it("survives a clinic that has never opened the screen", () => {
    expect(normalizeVaccineSettings(undefined)).toEqual(EMPTY);
    expect(normalizeVaccineSettings("nonsense")).toEqual(EMPTY);
  });

  it("drops an override it cannot read rather than repairing it", () => {
    // A half-understood override would propose a date, and a proposed date
    // is a claim. Missing costs one question and invents nothing.
    const settings = normalizeVaccineSettings({
      hidden: ["dog.core", 7],
      intervals: {
        "dog.rabies": { unit: "year", value: 2 },
        "dog.core": { unit: "fortnight", value: 2 },
        "cat.core": { unit: "year", value: 0 },
      },
      added: [
        { species: "DOG", name: "Leishmania" },
        { species: "DOG" },
        { name: "yalnız ad" },
      ],
    });
    expect(settings.hidden).toEqual(["dog.core"]);
    expect(settings.intervals).toEqual({ "dog.rabies": { unit: "year", value: 2 } });
    expect(settings.added).toEqual([{ species: "DOG", name: "Leishmania" }]);
  });
});

describe("finding the offer behind a typed name", () => {
  it("matches the catalogue name and the clinic's own", () => {
    const offers = clinicVaccineList("CAT", {
      ...EMPTY,
      added: [{ species: "CAT", name: "FIP" }],
    });
    expect(offerByName(offers, "karma")?.key).toBe("cat.core");
    expect(offerByName(offers, " FIP ")?.key).toBe("clinic:fip");
    expect(offerByName(offers, "bilinmeyen")).toBeNull();
  });
});
