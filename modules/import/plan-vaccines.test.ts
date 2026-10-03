import { describe, expect, it } from "vitest";
import { buildPlan, planRow, type Mapping } from "./plan";

/**
 * Vaccinations out of a row, and nothing lost on the way.
 *
 * The vet's condition for switching, in their words: a rabies date must
 * never disappear quietly. Every test here is one way a date could have
 * gone missing, and what happens instead.
 */
const TODAY = new Date(Date.UTC(2026, 9, 3));
const MAPPING: Mapping = {
  0: "client.firstName",
  1: "pet.name",
  2: "pet.birthDate",
  3: "vaccine.column",
  4: "vaccine.column",
};
const OPTIONS = {
  vaccineNames: { 3: "Kuduz", 4: "Karma" },
  columnLabels: { 2: "Doğum Tarihi", 3: "Kuduz Aşısı", 4: "Karma Aşı" },
  today: TODAY,
};

describe("one row, several vaccinations", () => {
  it("makes one record per filled vaccine column, named by the column", () => {
    const row = planRow(["Ayşe", "Pamuk", "2019-03-12", "2025-04-14", "2025-04-20"], MAPPING, {}, 1, OPTIONS);
    expect(row.vaccinations.map((v) => [v.name, v.administeredAt.toISOString().slice(0, 10)])).toEqual([
      ["Kuduz", "2025-04-14"],
      ["Karma", "2025-04-20"],
    ]);
    expect(row.warnings).toEqual([]);
  });

  it("skips an empty vaccine cell without a word, because nothing was there", () => {
    const row = planRow(["Ayşe", "Pamuk", "", "2025-04-14", ""], MAPPING, {}, 1, OPTIONS);
    expect(row.vaccinations).toHaveLength(1);
    expect(row.warnings).toEqual([]);
  });

  it("keeps a date it cannot read, in the animal's notes, and says so", () => {
    const row = planRow(["Elif", "Aslan", "", "geçen eylül", ""], MAPPING, {}, 1, OPTIONS);
    expect(row.vaccinations).toEqual([]);
    expect(row.warnings[0]).toMatchObject({ kind: "dateUnreadable", raw: "geçen eylül", vaccine: "Kuduz" });
    expect(row.pet?.notes).toContain("Kuduz Aşısı: geçen eylül");
  });

  it("does not record a vaccination dated after today", () => {
    const row = planRow(["Ayşe", "Pamuk", "", "26.10.2026", ""], MAPPING, { 3: "dayFirst" }, 1, OPTIONS);
    expect(row.vaccinations).toEqual([]);
    expect(row.warnings[0].kind).toBe("dateInFuture");
    expect(row.pet?.notes).toContain("26.10.2026");
  });

  it("reads the column's day-or-month answer for each vaccine column", () => {
    const row = planRow(["A", "B", "", "05/06/2024", ""], MAPPING, { 3: "dayFirst" }, 1, OPTIONS);
    expect(row.vaccinations[0].administeredAt.toISOString().slice(0, 10)).toBe("2024-06-05");
  });
});

describe("a year alone is not a birthday", () => {
  it("leaves the birth date empty and keeps the year in the notes", () => {
    const row = planRow(["Ayşe", "Zeytin", "2021", "", ""], MAPPING, {}, 1, OPTIONS);
    expect(row.pet?.birthDate).toBeNull();
    expect(row.warnings[0]).toMatchObject({ kind: "yearOnly", raw: "2021" });
    expect(row.pet?.notes).toBe("Doğum Tarihi: 2021");
  });
});

describe("the name-and-date pair", () => {
  const PAIR: Mapping = { 0: "client.firstName", 1: "pet.name", 2: "vaccine.name", 3: "vaccine.date", 4: "vaccine.nextDue" };

  it("writes the file's own next date with the record", () => {
    const row = planRow(["A", "B", "Kuduz", "03.02.2025", "03.02.2026"], PAIR, {}, 1, { today: TODAY });
    expect(row.vaccinations[0]).toMatchObject({ name: "Kuduz" });
    expect(row.vaccinations[0].nextDueAt?.toISOString().slice(0, 10)).toBe("2026-02-03");
  });

  it("keeps a name with no date as a note rather than a record without a day", () => {
    const row = planRow(["A", "B", "Kuduz", "", ""], PAIR, {}, 1, { today: TODAY });
    expect(row.vaccinations).toEqual([]);
    expect(row.warnings[0].kind).toBe("vaccineNoDate");
  });
});

describe("a re-import recognises an owner with no phone by their animal", () => {
  it("matches the one client of that name who already has that animal", () => {
    const plan = buildPlan(
      [["Hasan Öztürk", "Paşa"]],
      { 0: "client.firstName", 1: "pet.name" },
      {},
      [
        { id: "c1", firstName: "Hasan Öztürk", lastName: null, phone: null, secondaryPhone: null, pets: [{ id: "p1", name: "Paşa" }] },
      ],
    );
    expect(plan.groups[0].matchedClientId).toBe("c1");
    expect(plan.groups[0].possible).toBeUndefined();
  });

  it("still asks when two clients of that name have it", () => {
    const pets = [{ id: "p", name: "Paşa" }];
    const plan = buildPlan(
      [["Hasan Öztürk", "Paşa"]],
      { 0: "client.firstName", 1: "pet.name" },
      {},
      [
        { id: "c1", firstName: "Hasan Öztürk", lastName: null, phone: null, secondaryPhone: null, pets },
        { id: "c2", firstName: "Hasan Öztürk", lastName: null, phone: null, secondaryPhone: null, pets },
      ],
    );
    expect(plan.groups[0].matchedClientId).toBeUndefined();
    expect(plan.groups[0].possible).toHaveLength(2);
  });
});

describe("two note columns are two notes", () => {
  it("joins them instead of keeping the first", () => {
    const row = planRow(["A", "B", "alerjik", "ısırır"], { 0: "client.firstName", 1: "pet.name", 2: "pet.notes", 3: "pet.notes" }, {}, 1);
    expect(row.pet?.notes).toBe("alerjik · ısırır");
  });
});

describe("same name, two different numbers", () => {
  it("is two people, not a question -- the numbers are evidence, not a gap", () => {
    const plan = buildPlan(
      [
        ["Ayşe Yılmaz", "0532 111 22 33", "Pamuk"],
        ["Ayşe Yılmaz", "0544 999 88 77", "Boncuk"],
      ],
      { 0: "client.firstName", 1: "client.phone", 2: "pet.name" },
      {},
      [{ id: "c1", firstName: "Ayşe Yılmaz", lastName: null, phone: "0555 000 00 00", secondaryPhone: null }],
    );
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups.every((g) => !g.possible)).toBe(true);
  });

  it("still asks when one of them has no number to check", () => {
    const plan = buildPlan(
      [
        ["Ayşe Yılmaz", "0532 111 22 33", "Pamuk"],
        ["Ayşe Yılmaz", "", "Boncuk"],
      ],
      { 0: "client.firstName", 1: "client.phone", 2: "pet.name" },
      {},
      [],
    );
    expect(plan.groups.some((g) => g.possible && g.possible.length > 0)).toBe(true);
  });
});
