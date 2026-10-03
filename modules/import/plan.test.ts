import { describe, expect, it } from "vitest";
import {
  buildPlan,
  openQuestions,
  parseDate,
  planRow,
  rowValues,
  type DuplicateAnswer,
  type ExistingClient,
  type Mapping,
} from "./plan";

/**
 * Fixtures build a MECHANISM, as everywhere else in this folder. "A name
 * with no phone behind it is a question rather than a merge" is true of
 * every clinic's file; none of these rows claims to be one.
 */

const MAPPING: Mapping = {
  0: "client.firstName",
  1: "client.lastName",
  2: "client.phone",
  3: "pet.name",
  4: "pet.species",
  5: "pet.birthDate",
  6: "pet.weightKg",
  7: "client.city",
};

const row = (cells: string[], index = 1) => planRow(cells, MAPPING, {}, index);

describe("reading one row through the vet's answers", () => {
  it("takes the first non-empty value when two columns went to one field", () => {
    // Nothing on the screen stops a vet mapping two columns to one field, and
    // the alternative rules both lose data: last-wins lets a blank erase a
    // value, and refusing outright throws the row away over their choice.
    const values = rowValues(["", "Ada"], { 0: "client.firstName", 1: "client.firstName" });
    expect(values["client.firstName"]).toBe("Ada");
  });

  it("reads a clinic's blank markers as blanks, not as values", () => {
    // Otherwise the import creates a client whose surname is a dash. The
    // screen already classifies these as blanks; writing must agree with the
    // screen the vet answered on.
    const parsed = row(["Ada", "-", "yok", "Boncuk", "Kedi", "", ""]);
    expect(parsed.owner?.lastName).toBeNull();
    expect(parsed.owner?.phone).toBeNull();
  });

  it("makes nobody out of a row with no name for the person", () => {
    // Deliberately not a placeholder owner: an animal nobody can be called
    // about is a record the vet meets months later as a mystery.
    const parsed = row(["", "", "0532 111 22 33", "Boncuk", "Kedi", "", ""]);
    expect(parsed.issue).toBe("noOwnerName");
    expect(parsed.owner).toBeNull();
    expect(parsed.pet).toBeNull();
  });

  it("creates the person and reports the missing animal, rather than inventing a name", () => {
    const parsed = row(["Ada", "Kaya", "0532 111 22 33", "", "", "", ""]);
    expect(parsed.issue).toBe("noPetName");
    expect(parsed.owner?.firstName).toBe("Ada");
    expect(parsed.pet).toBeNull();
  });

  it("never asserts that an imported animal is alive", () => {
    // The column defaults to false, so writing it would claim a fact about
    // every row in the file -- including the animals that died years ago.
    // The draft may not carry the field at all.
    const parsed = row(["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kedi", "", ""]);
    expect(parsed.pet).not.toBeNull();
    expect(Object.keys(parsed.pet ?? {})).not.toContain("deceased");
    expect(Object.keys(parsed.pet ?? {})).not.toContain("deceasedAt");
  });

  it("reads a comma as a decimal point and refuses a weight that is not one", () => {
    expect(row(["Ada", "", "", "Boncuk", "", "", "12,5"]).pet?.weightKg).toBe(12.5);
    expect(row(["Ada", "", "", "Boncuk", "", "", "agir"]).pet?.weightKg).toBeNull();
  });
});

describe("dates: the value decides where it can, the answer only breaks a tie", () => {
  it("reads an ISO date without consulting the column's answer", () => {
    // What `read-workbook` writes a real Excel date out as.
    expect(parseDate("2020-03-14", "monthFirst")?.toISOString()).toBe(
      "2020-03-14T00:00:00.000Z",
    );
  });

  it("will not let a column answer turn 25 into a month", () => {
    const parsed = parseDate("25.12.2020", "monthFirst");
    expect(parsed?.getUTCMonth()).toBe(11);
    expect(parsed?.getUTCDate()).toBe(25);
  });

  it("uses the answer exactly where the value is ambiguous", () => {
    expect(parseDate("03.04.2020", "dayFirst")?.getUTCMonth()).toBe(3);
    expect(parseDate("03.04.2020", "monthFirst")?.getUTCMonth()).toBe(2);
  });

  it("refuses a date that does not exist instead of rolling it over", () => {
    // `new Date(2020, 1, 31)` is 2 March, which would be a birth date nobody
    // typed and nothing on screen would ever question.
    expect(parseDate("31.02.2020")).toBeNull();
    expect(parseDate("bilinmiyor")).toBeNull();
  });
});

describe("one person, as far as the file can tell", () => {
  const rows = [
    ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kedi", "", ""],
    ["Ada", "Kaya", "0532 111 22 33", "Limon", "Kedi", "", ""],
  ];

  it("puts one person's animals under one person", () => {
    const plan = buildPlan(rows, MAPPING, {}, []);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].rowIndexes).toEqual([1, 2]);
  });

  it("recognises the same number written differently", () => {
    const plan = buildPlan(
      [rows[0], ["Ada", "Kaya", "+90 532 111 22 33", "Limon", "Kedi", "", ""]],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(1);
  });

  it("keeps two people apart when the numbers differ", () => {
    const plan = buildPlan(
      [rows[0], ["Ada", "Kaya", "0533 222 33 44", "Limon", "Kedi", "", ""]],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(2);
  });

  it("carries a value one of their rows has and the other does not", () => {
    const plan = buildPlan(
      [
        ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "", "", "", ""],
        ["Ada", "Kaya", "0532 111 22 33", "Limon", "", "", "", "Izmir"],
      ],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].owner.city).toBe("Izmir");
  });

  it("asks about one number written once with a surname and once without", () => {
    // The name-and-phone key cannot see this pair, because the names differ.
    // Asked rather than merged, and asked rather than dropped: the vet is
    // the only one who knows whether the file lost the surname or the
    // household has two people.
    const plan = buildPlan(
      [
        ["Ada", "", "0532 111 22 33", "Boncuk", "", "", "", ""],
        ["Ada", "Kaya", "0532 111 22 33", "Limon", "", "", "", ""],
      ],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(2);
    expect(openQuestions(plan, {})).toHaveLength(2);
  });

  it("does not turn a household sharing one number into a question", () => {
    // A guard for the guard: without the name test above, every family in
    // the file becomes a duplicate question, and questions that are almost
    // always "no" teach the vet to click through the ones that matter.
    const plan = buildPlan(
      [
        ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "", "", "", ""],
        ["Deniz", "Kaya", "0532 111 22 33", "Limon", "", "", "", ""],
      ],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(2);
    expect(openQuestions(plan, {})).toEqual([]);
  });
});

describe("the same person the clinic already has", () => {
  const existing: ExistingClient[] = [
    { id: "c1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33", secondaryPhone: null },
  ];

  it("attaches the animal to them instead of creating a second record", () => {
    const plan = buildPlan(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      existing,
    );
    expect(plan.groups[0].matchedClientId).toBe("c1");
    expect(plan.groups[0].possible).toBeUndefined();
  });

  it("matches the number the clinic recorded second", () => {
    // A clinic's spreadsheet holds the number the client actually answers,
    // which is not always the one in the first column of their record.
    const plan = buildPlan(
      [["Ada", "Kaya", "0533 222 33 44", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      [{ ...existing[0], secondaryPhone: "0533 222 33 44" }],
    );
    expect(plan.groups[0].matchedClientId).toBe("c1");
  });

  it("folds the name the Turkish way before comparing", () => {
    const plan = buildPlan(
      [["AYŞE", "ÇELİK", "0532 111 22 33", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      [{ id: "c2", firstName: "Ayşe", lastName: "Çelik", phone: "0532 111 22 33", secondaryPhone: null }],
    );
    expect(plan.groups[0].matchedClientId).toBe("c2");
  });
});

describe("no phone means a question, and a question has no default answer", () => {
  it("does not merge two rows that only share a name", () => {
    // The whole reason the phone is in the key. A wrong merge puts one
    // family's animals in another family's file, and the vet reading it
    // later has no way to tell.
    const plan = buildPlan(
      [
        ["Ada", "Kaya", "", "Boncuk", "", "", ""],
        ["Ada", "Kaya", "0532 111 22 33", "Limon", "", "", ""],
      ],
      MAPPING,
      {},
      [],
    );
    expect(plan.groups).toHaveLength(2);
    // And the product says out loud that they might be one person.
    expect(plan.groups.some((g) => (g.possible?.length ?? 0) > 0)).toBe(true);
  });

  it("does not merge onto an existing client on the strength of a name", () => {
    const plan = buildPlan(
      [["Ada", "Kaya", "", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      [{ id: "c1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33", secondaryPhone: null }],
    );
    expect(plan.groups[0].matchedClientId).toBeUndefined();
    expect(plan.groups[0].possible?.[0]).toMatchObject({ kind: "existing", id: "c1" });
  });

  it("blocks until the question is answered, and stops blocking once it is", () => {
    const plan = buildPlan(
      [["Ada", "Kaya", "", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      [{ id: "c1", firstName: "Ada", lastName: "Kaya", phone: null, secondaryPhone: null }],
    );
    const key = plan.groups[0].key;
    expect(openQuestions(plan, {})).toEqual([key]);

    const answered: Record<string, DuplicateAnswer> = { [key]: { kind: "separate" } };
    expect(openQuestions(plan, answered)).toEqual([]);
  });

  it("asks nothing when nobody shares the name", () => {
    // A guard for the guard above: if this went red the suite would be
    // asserting that everything is a question, which is not a rule.
    const plan = buildPlan(
      [["Ada", "Kaya", "", "Boncuk", "", "", ""]],
      MAPPING,
      {},
      [{ id: "c1", firstName: "Deniz", lastName: "Yilmaz", phone: null, secondaryPhone: null }],
    );
    expect(plan.groups[0].possible).toBeUndefined();
    expect(openQuestions(plan, {})).toEqual([]);
  });
});

describe("what the plan reports rather than silently drops", () => {
  it("counts the blank lines and the rows with nobody in them separately from the rest", () => {
    const plan = buildPlan(
      [
        ["", "", "", "", "", "", ""],
        ["", "", "0532 111 22 33", "Boncuk", "", "", ""],
        ["Ada", "Kaya", "0532 111 22 33", "", "", "", ""],
      ],
      MAPPING,
      {},
      [],
    );
    expect(plan.skipped).toEqual([
      { index: 1, issue: "blank" },
      { index: 2, issue: "noOwnerName" },
    ]);
    expect(plan.clientOnly).toEqual([3]);
  });
});
