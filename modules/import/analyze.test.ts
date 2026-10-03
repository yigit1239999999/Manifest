import { describe, expect, it } from "vitest";
import { analyzeRows, type ExistingData, type IssueCode } from "./analyze";
import type { ColumnMapping } from "./fields";

const today = new Date("2026-10-03T09:00:00Z");

const MAPPING: ColumnMapping = [
  "ownerName",
  "phone",
  "email",
  "petName",
  "species",
  "sex",
  "birthDate",
  "microchip",
  "vaccineName",
  "vaccineDate",
  "vaccineNextDue",
];

type Row = Partial<{
  owner: string;
  phone: string;
  email: string;
  pet: string;
  species: string;
  sex: string;
  birth: string;
  chip: string;
  vaccine: string;
  given: string;
  next: string;
}>;

const row = (r: Row): string[] => [
  r.owner ?? "Ayşe Yılmaz",
  r.phone ?? "",
  r.email ?? "",
  r.pet ?? "Pamuk",
  r.species ?? "Kedi",
  r.sex ?? "",
  r.birth ?? "",
  r.chip ?? "",
  r.vaccine ?? "",
  r.given ?? "",
  r.next ?? "",
];

const none: ExistingData = { clients: [], pets: [], customSpecies: [] };

function run(rows: Row[], existing: ExistingData = none, options = {}) {
  return analyzeRows(rows.map(row), MAPPING, existing, {
    dateOrder: null,
    speciesChoices: {},
    today,
    ...options,
  });
}

const codes = (a: ReturnType<typeof run>, i: number): IssueCode[] =>
  a.rows[i].issues.map((x) => x.code);

describe("owners within one file", () => {
  it("is one owner however the phone number is written", () => {
    const a = run([
      { phone: "0532 123 45 67", pet: "Pamuk" },
      { phone: "+90 532 123 4567", pet: "Karabaş" },
      { phone: "5321234567", pet: "Tekir" },
    ]);
    expect(a.counts.newClients).toBe(1);
    expect(a.counts.pets).toBe(3);
    expect(new Set(a.rows.map((r) => r.ownerId)).size).toBe(1);
  });

  it("falls back to e-mail, case aside", () => {
    const a = run([
      { owner: "Ali Kaya", email: "Ali@Ornek.com", pet: "Boncuk" },
      { owner: "Ali Kaya", email: "ali@ornek.com", pet: "Duman" },
    ]);
    expect(a.counts.newClients).toBe(1);
  });

  it("keeps two people with one name apart when their numbers differ", () => {
    const a = run([
      { owner: "Ali Kaya", phone: "0532 111 11 11", pet: "Boncuk" },
      { owner: "Ali Kaya", phone: "0533 222 22 22", pet: "Duman" },
    ]);
    expect(a.counts.newClients).toBe(2);
  });

  it("joins a row with no contact to the one owner of that name, and says so", () => {
    const a = run([
      { owner: "Ali Kaya", phone: "0532 111 11 11", pet: "Boncuk" },
      { owner: "Ali Kaya", pet: "Duman" },
    ]);
    expect(a.counts.newClients).toBe(1);
    expect(a.rows[1].status).toBe("warning");
    expect(a.rows[1].issues).toContainEqual({ code: "noContactJoined", line: 2 });
  });

  it("does not guess which of two same-named owners a contactless row belongs to", () => {
    const a = run([
      { owner: "Ali Kaya", phone: "0532 111 11 11", pet: "Boncuk" },
      { owner: "Ali Kaya", phone: "0533 222 22 22", pet: "Duman" },
      { owner: "Ali Kaya", pet: "Minnoş" },
    ]);
    expect(a.counts.newClients).toBe(3);
    expect(codes(a, 2)).toContain("noContactManyNames");
  });

  it("names the owner a shared number is filed under when the names differ", () => {
    const a = run([
      { owner: "Ayşe Yılmaz", phone: "0532 123 45 67", pet: "Pamuk" },
      { owner: "Mehmet Yılmaz", phone: "0532 123 45 67", pet: "Karabaş" },
    ]);
    expect(a.counts.newClients).toBe(1);
    expect(a.rows[1].issues).toContainEqual({
      code: "sameContactOtherName",
      name: "Ayşe Yılmaz",
      line: 2,
    });
  });
});

describe("owners already in the clinic", () => {
  const existing: ExistingData = {
    clients: [
      {
        id: "client-ayse",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "+90 (532) 123 45 67",
        secondaryPhone: null,
        email: null,
        archived: false,
      },
      {
        id: "client-old",
        firstName: "Can",
        lastName: "Demir",
        phone: "0544 999 99 99",
        secondaryPhone: null,
        email: "can@ornek.com",
        archived: true,
      },
      {
        id: "client-zeynep",
        firstName: "Zeynep",
        lastName: "Kara",
        phone: null,
        secondaryPhone: null,
        email: null,
        archived: false,
      },
    ],
    pets: [{ ownerId: "client-ayse", name: "Pamuk", microchipId: "900111222333444" }],
    customSpecies: [],
  };

  it("adds the animals to the existing client instead of creating a second one", () => {
    const a = run([{ phone: "05321234567", pet: "Karabaş", species: "Köpek" }], existing);
    expect(a.counts.newClients).toBe(0);
    expect(a.counts.existingClients).toBe(1);
    expect(a.owners[0].existing).toEqual({ id: "client-ayse", name: "Ayşe Yılmaz" });
    expect(a.rows[0].status).toBe("ready");
  });

  it("skips an animal the existing client already has, so importing twice is harmless", () => {
    const a = run([{ phone: "0532 123 45 67", pet: "pamuk" }], existing);
    expect(a.rows[0].status).toBe("duplicate");
    expect(codes(a, 0)).toEqual(["petExists"]);
    expect(a.counts.pets).toBe(0);
    expect(a.owners).toEqual([]);
  });

  it("skips an animal whose microchip is already registered", () => {
    const a = run([{ owner: "Ali Kaya", phone: "0555 000 00 00", pet: "Başka", chip: "900 111 222 333 444" }], existing);
    expect(codes(a, 0)).toEqual(["chipExists"]);
  });

  it("does not attach animals to an archived client, and says why a new one is made", () => {
    const a = run([{ owner: "Can Demir", phone: "0544 999 99 99", pet: "Zeytin" }], existing);
    expect(a.counts.newClients).toBe(1);
    expect(codes(a, 0)).toContain("archivedMatch");
  });

  it("warns when a contactless owner shares a name with an existing client", () => {
    const a = run([{ owner: "Zeynep Kara", pet: "Fındık" }], existing);
    expect(a.counts.newClients).toBe(1);
    expect(codes(a, 0)).toContain("existingNameNoContact");
  });
});

describe("rows that cannot go in", () => {
  it("blocks only their own row", () => {
    const a = run([
      { owner: "Ali Kaya", pet: "" },
      { owner: "Ayşe" },
      { owner: "Can Demir", species: "" },
      { pet: "Tekir" },
    ]);
    expect(a.rows.map((r) => r.status)).toEqual(["error", "error", "error", "ready"]);
    expect(codes(a, 0)).toEqual(["petNameMissing"]);
    expect(codes(a, 1)).toEqual(["ownerNameSingle"]);
    expect(codes(a, 2)).toEqual(["speciesMissing"]);
    expect(a.counts).toMatchObject({ pets: 1, skipped: 3, errors: 3 });
  });

  it("skips a row repeated in the file and points at the first", () => {
    const a = run([{ phone: "0532 123 45 67" }, { phone: "0532 123 45 67" }]);
    expect(a.rows[1].issues).toEqual([{ code: "duplicateInFile", line: 2 }]);
    expect(a.counts.pets).toBe(1);
  });

  it("ignores blank rows and counts them apart from skipped ones", () => {
    const rows = [row({}), MAPPING.map(() => ""), row({ pet: "Tekir" })];
    const a = analyzeRows(rows, MAPPING, none, { dateOrder: null, speciesChoices: {}, today });
    expect(a.counts).toMatchObject({ rows: 2, blank: 1, pets: 2, skipped: 0 });
    expect(a.rows.map((r) => r.line)).toEqual([2, 4]);
  });
});

describe("dates", () => {
  it("holds a row with an ambiguous date until the order is chosen", () => {
    const rows = [{ birth: "03/04/2020" }, { pet: "Tekir", birth: "12.05.2021" }];
    const before = run(rows);
    expect(before.rows[0].status).toBe("error");
    expect(before.rows[0].issues).toEqual([
      { code: "dateAmbiguous", field: "birthDate", raw: "03/04/2020" },
    ]);
    expect(before.dates).toMatchObject({ ambiguous: 1, order: null });

    const after = run(rows, none, { dateOrder: "MDY" });
    expect(after.rows[0].status).toBe("ready");
    expect(after.rows[0].pet?.birthDate).toBe("2020-03-04");
    expect(after.dates.order).toBe("MDY");
  });

  it("keeps an animal whose birth date cannot be read, without the date, and says so", () => {
    const a = run([{ birth: "geçen bahar" }]);
    expect(a.rows[0].status).toBe("warning");
    expect(a.rows[0].pet?.birthDate).toBeNull();
    expect(codes(a, 0)).toEqual(["dateInvalid"]);
  });

  it("refuses a birth date in the future", () => {
    const a = run([{ birth: "01.01.2030" }]);
    expect(a.rows[0].pet?.birthDate).toBeNull();
    expect(codes(a, 0)).toEqual(["dateFuture"]);
  });
});

describe("vaccinations", () => {
  it("imports a vaccine with its date and next due date", () => {
    const a = run([{ vaccine: "Kuduz", given: "22.01.2026", next: "22.01.2027" }]);
    expect(a.rows[0].vaccine).toEqual({ name: "Kuduz", date: "2026-01-22", nextDue: "2027-01-22" });
    expect(a.counts.vaccinations).toBe(1);
  });

  it("never invents the day a vaccine was given", () => {
    const a = run([{ vaccine: "Kuduz", next: "22.01.2027" }]);
    expect(a.rows[0].vaccine).toBeNull();
    expect(codes(a, 0)).toEqual(["vaccineNoDate"]);
    expect(a.rows[0].pet).not.toBeNull();
  });
});

describe("species", () => {
  it("recognises built-in species in either language and any case", () => {
    const a = run([{ species: "KEDİ" }, { pet: "B", species: "dog" }, { pet: "C", species: "Köpek" }]);
    expect(a.rows.map((r) => r.pet?.species)).toEqual([
      { kind: "builtIn", species: "CAT" },
      { kind: "builtIn", species: "DOG" },
      { kind: "builtIn", species: "DOG" },
    ]);
  });

  it("uses the clinic's own species before offering a new one", () => {
    const a = run([{ species: "papagan" }], {
      ...none,
      customSpecies: [{ id: "cs-1", name: "Papağan" }],
    });
    expect(a.rows[0].pet?.species).toEqual({ kind: "custom", id: "cs-1", name: "Papağan" });
    expect(a.species).toEqual([]);
  });

  it("asks about an unknown species and says it will be added until answered", () => {
    const a = run([{ species: "Muhabbet kuşu" }, { pet: "Maviş", species: "muhabbet kusu" }]);
    expect(a.species).toEqual([
      { key: "muhabbet kusu", label: "Muhabbet kuşu", rows: 2, choice: "new" },
    ]);
    expect(codes(a, 0)).toEqual(["speciesNew"]);
    expect(a.counts.newSpecies).toBe(1);

    const mapped = run([{ species: "Muhabbet kuşu" }], none, {
      speciesChoices: { "muhabbet kusu": "BIRD" },
    });
    expect(mapped.rows[0].pet?.species).toEqual({ kind: "builtIn", species: "BIRD" });
    expect(mapped.rows[0].status).toBe("ready");
  });

  it("ignores a species choice that points at another clinic's species", () => {
    const a = run([{ species: "Muhabbet kuşu" }], none, {
      speciesChoices: { "muhabbet kusu": "custom:someone-elses" },
    });
    expect(a.rows[0].pet?.species).toEqual({ kind: "new", name: "Muhabbet kuşu" });
  });
});
