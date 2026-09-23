import { describe, expect, it } from "vitest";
import type { IntervalSuggestion } from "@/lib/vaccination-interval";
import {
  clinicVaccineList,
  normalizeVaccineSettings,
  offerByName,
  officialYearsFrom,
  seriesFrom,
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
  it("matches a name the clinic stopped using, so past doses still count", () => {
    // The dose count is what this is for: a "Karma" written last year under
    // the old long name is still one of the three, and a count that only
    // matched today's name would restart a series the vet had nearly
    // finished -- the failure the whole feature exists to stop.
    const offers = clinicVaccineList("DOG", EMPTY);
    expect(
      offerByName(offers, "Karma - Parvo, Gençlik, Hepatit, Parainfluenza (DHPPi)")?.key,
    ).toBe("dog.core");
  });

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

/**
 * Where the animal is, read from its own record (#45).
 *
 * The vet's loss, in their words: "sahibi ikinci dozdan sonra kayboluyor,
 * üç ay sonra geliyor... emin olamayınca baştan başlatıyorum, sahibi de
 * boşuna para veriyor." Everything here is about not making that mistake
 * on the vet's behalf, in either direction: not inventing a position for
 * doses that never stated one, and not hiding one that did.
 */
const DOG = clinicVaccineList("DOG", EMPTY);
const at = (iso: string) => new Date(`${iso}T10:00:00Z`);
const dose = (
  name: string,
  day: string,
  doseNumber: number | null,
  seriesOf: number | null,
  nextDueAt: string | null = null,
) => ({
  name,
  administeredAt: at(day),
  nextDueAt: nextDueAt ? at(nextDueAt) : null,
  doseNumber,
  seriesOf,
});

describe("which dose we were on", () => {
  it("reads the position from the latest dose that states one", () => {
    const [progress] = seriesFrom(
      DOG,
      [dose("Karma", "2026-06-01", 1, 3), dose("Karma", "2026-06-25", 2, 3, "2026-07-20")],
      at("2026-09-23"),
    );
    expect(progress).toMatchObject({ key: "dog.core", dose: 2, of: 3, overdue: true });
  });

  it("says nothing about doses that never stated a position", () => {
    // Every row written before #37 is this. Counting them would use
    // today's catalogue to restate a history that predates it.
    expect(seriesFrom(DOG, [dose("Karma", "2026-06-01", null, null)])).toEqual([]);
  });

  it("does not read four annual boosters as an unfinished puppy series", () => {
    const rows = ["2022-05-01", "2023-05-01", "2024-05-01", "2025-05-01"].map((day) =>
      dose("Kuduz", day, null, null),
    );
    expect(seriesFrom(DOG, rows)).toEqual([]);
  });

  it("drops a series the animal has finished", () => {
    expect(seriesFrom(DOG, [dose("Karma", "2026-07-20", 3, 3)])).toEqual([]);
  });

  it("keeps the number the record was written with when the list changes", () => {
    // `seriesOf` is a snapshot. A dose written as 2 of 3 stays 2 of 3
    // even if the shipped list later says four.
    const [progress] = seriesFrom(DOG, [dose("Karma", "2026-06-25", 2, 3)]);
    expect(progress.of).toBe(3);
  });

  it("claims nothing about lateness when the record carries no date", () => {
    const [progress] = seriesFrom(DOG, [dose("Karma", "2020-01-01", 2, 3)], at("2026-09-23"));
    expect(progress.overdue).toBe(false);
  });

  it("follows a dose written under a name the list no longer offers", () => {
    const [progress] = seriesFrom(DOG, [dose("DHPPi", "2026-06-25", 2, 3)]);
    expect(progress.key).toBe("dog.core");
  });
});

describe("the pattern somebody outside the clinic asks about", () => {
  const year = (d: Date) => Number(d.toISOString().slice(0, 4));

  it("shows the gap between two years as a gap", () => {
    const pattern = officialYearsFrom(
      DOG,
      [dose("Kuduz", "2023-05-10", null, null), dose("Kuduz", "2025-05-10", null, null)],
      year,
      2026,
    );
    expect(pattern?.name).toBe("Kuduz");
    expect(pattern?.years).toEqual([
      { year: 2023, given: true },
      { year: 2024, given: false },
      { year: 2025, given: true },
      { year: 2026, given: false },
    ]);
  });

  it("is silent about an animal this clinic never gave it to", () => {
    // Not "every year missing": these are years that were never this
    // clinic's to answer for.
    expect(officialYearsFrom(DOG, [dose("Karma", "2024-05-10", 1, 3)], year, 2026)).toBeNull();
  });

  it("counts a dose written under the old name", () => {
    const pattern = officialYearsFrom(
      DOG,
      [dose("Kuduz (Rabies)", "2025-05-10", null, null)],
      year,
      2025,
    );
    expect(pattern?.years).toEqual([{ year: 2025, given: true }]);
  });

  it("asks the caller which year a dose falls in, rather than assuming UTC", () => {
    // 1 January 01:00 in Istanbul is 31 December in UTC. The clinic's
    // calendar decides, so the year function is handed in.
    const istanbul = (d: Date) =>
      Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric" }).format(d),
      );
    const pattern = officialYearsFrom(
      DOG,
      [{ ...dose("Kuduz", "2024-01-01", null, null), administeredAt: new Date("2023-12-31T22:30:00Z") }],
      istanbul,
      2024,
    );
    expect(pattern?.years[0]).toEqual({ year: 2024, given: true });
  });
});
