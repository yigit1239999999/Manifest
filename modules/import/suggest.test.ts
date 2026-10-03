import { describe, expect, it } from "vitest";
import { classifyColumn, isBlank } from "./infer";
import { hintFor, suggestMapping, vaccineFromHeading, type ImportField } from "./fields";

/**
 * The whole-sheet reading, against the owner's own test files.
 *
 * REGRESSION, owner's screenshot of 3 October 2026: the clean template-like
 * file `01-temiz-liste.xlsx` showed "Not chosen -- the values do not point
 * at one field" under "Sahip Adı Soyadı", "Telefon", "Adres", "Hayvan Adı"
 * and "Tür", and mapped only "E-posta". The cause was the rule that a
 * column is settled only when its CONTENT leaves one field: every text
 * column admits a dozen fields and two phone fields exist, so a heading
 * could only reorder the list and never answer it. A heading that agrees
 * with its values now answers (`suggestMapping`), and the file maps whole.
 */
function sheet(headings: string[], rows: string[][]) {
  return headings.map((heading, col) => {
    const values = rows.map((r) => r[col] ?? "");
    return { col, heading, evidence: classifyColumn(values), values: values.filter((v) => !isBlank(v)) };
  });
}

const fieldsOf = (columns: ReturnType<typeof sheet>) =>
  Object.fromEntries(suggestMapping(columns).map((s) => [columns[s.col].heading, s.field]));

describe("01-temiz-liste.xlsx, all 17 headings", () => {
  const HEADINGS = [
    "Sahip Adı Soyadı", "Telefon", "E-posta", "Adres", "Hayvan Adı", "Tür", "Irk", "Cinsiyet",
    "Doğum Tarihi", "Renk", "Çip Numarası", "Kısırlaştırıldı mı", "Kilo (kg)", "Aşı Adı",
    "Aşı Tarihi", "Sonraki Aşı Tarihi", "Notlar",
  ];
  const ROWS = [
    ["Ayşe Tekin", "0535 210 55 09", "ayse.tekin@example.com", "Nilüfer Mah. 43. Sok. No:14", "Fındık", "Kedi", "Scottish Fold", "Erkek", "17.05.2019", "Siyah-beyaz", "", "", "6.2", "Karma (FVRCP)", "20.05.2026", "20.05.2027", ""],
    ["Onur Erdem", "0544 684 51 45", "onur.erdem@example.com", "Karşıyaka Mah. 66. Sok. No:10", "Bal", "Köpek", "Golden Retriever", "Erkek", "06.07.2015", "Krem", "900156152238583", "Hayır", "24.4", "Kennel Cough", "07.04.2026", "07.04.2027", ""],
    ["Gizem Polat", "0555 053 88 73", "gizem.polat@example.com", "Karşıyaka Mah. 38. Sok. No:37", "Duman", "Kedi", "British Shorthair", "Erkek", "25.09.2019", "Siyah-beyaz", "900113364682678", "Evet", "5.2", "Kuduz", "03.02.2025", "03.02.2026", ""],
  ];

  it("maps every column with nothing left for the vet", () => {
    const suggestions = suggestMapping(sheet(HEADINGS, ROWS));
    expect(suggestions.every((s) => s.confidence === "recognized")).toBe(true);
    expect(fieldsOf(sheet(HEADINGS, ROWS))).toEqual({
      "Sahip Adı Soyadı": "client.firstName",
      Telefon: "client.phone",
      "E-posta": "client.email",
      Adres: "client.address",
      "Hayvan Adı": "pet.name",
      Tür: "pet.species",
      Irk: "pet.breed",
      Cinsiyet: "pet.sex",
      "Doğum Tarihi": "pet.birthDate",
      Renk: "pet.color",
      "Çip Numarası": "pet.microchipId",
      "Kısırlaştırıldı mı": "pet.neutered",
      "Kilo (kg)": "pet.weightKg",
      "Aşı Adı": "vaccine.name",
      "Aşı Tarihi": "vaccine.date",
      "Sonraki Aşı Tarihi": "vaccine.nextDue",
      Notlar: "skip",
    });
  });
});

describe("several vaccines, each its own column (the vet's must-have)", () => {
  it("reads 'Kuduz Aşısı' and 'Karma Aşı' as two vaccine columns, named by their heading", () => {
    const columns = sheet(
      ["Sahip Adı Soyadı", "Tel", "Hasta Adı", "Doğum Tarihi", "Kuduz Aşısı", "Karma Aşı"],
      [
        ["Ayşe Yılmaz", "0532 411 22 33", "Pamuk", "2019-03-12", "2025-04-14", "2025-04-14"],
        ["Mehmet Kaya", "05334567890", "Karabaş", "05/06/2022", "2024-09-20", ""],
      ],
    );
    const s = suggestMapping(columns);
    expect(s[4]).toMatchObject({ field: "vaccine.column", vaccineName: "Kuduz", confidence: "recognized" });
    expect(s[5]).toMatchObject({ field: "vaccine.column", vaccineName: "Karma", confidence: "recognized" });
    // And the birth date stays the birth date: before this, all three date
    // columns were "settled" as the birth date, and the first filled one won.
    expect(s[3].field).toBe("pet.birthDate");
  });

  it("knows a vaccine by its name alone, as the secretary's CSV writes it", () => {
    expect(vaccineFromHeading("Kuduz")).toBe("Kuduz");
    expect(vaccineFromHeading("KUDUZ AŞISI")).toBe("Kuduz");
    expect(vaccineFromHeading("Lyme Aşısı")).toBe("Lyme");
    expect(vaccineFromHeading("Aşı Tarihi")).toBeNull();
    expect(vaccineFromHeading("Sonraki Kuduz")).toBeNull();
  });
});

describe("short headings and content", () => {
  it("hears 'Tel' inside 'Sahip Tel', and not 'il' inside 'Bilgi'", () => {
    expect(hintFor("Sahip Tel")).toBe("client.phone");
    expect(hintFor("Bilgi")).toBeNull();
    expect(hintFor("Adres")).toBe("client.address");
    expect(hintFor("Müşteri Soyadı")).toBe("client.lastName");
    expect(hintFor("Cinsiyeti")).toBe("pet.sex");
    expect(hintFor("Cinsi")).toBe("pet.breed");
    expect(hintFor("D.Tarihi")).toBe("pet.birthDate");
  });

  it("proposes from the values when the heading says nothing, without applying it", () => {
    const columns = sheet(
      ["Kolon1", "Kolon2", "Kolon3"],
      [
        ["0532 111 22 33", "900123456789012", "Kedi"],
        ["0533 222 33 44", "900123456789013", "Köpek"],
      ],
    );
    const s = suggestMapping(columns);
    expect(s[0]).toMatchObject({ field: "client.phone", confidence: "suggested", looksLike: "phone" });
    expect(s[1]).toMatchObject({ field: "pet.microchipId", confidence: "suggested", looksLike: "chip" });
    // Species words name their column under any heading.
    expect(s[2]).toMatchObject({ field: "pet.species", confidence: "recognized" });
  });

  it("gives a generic 'isim' to the owner when another column is plainly the animal", () => {
    const s = suggestMapping(
      sheet(["isim", "telefon", "hayvan(lar)"], [["ayşe yılmaz", "0532 411 22 33", "Pamuk"]]),
    );
    expect(s.map((x) => x.field)).toEqual<(ImportField | null)[]>([
      "client.firstName",
      "client.phone",
      "pet.name",
    ]);
  });

  it("never lets a heading put names in the phone field", () => {
    const s = suggestMapping(sheet(["Tel"], [["Boncuk"], ["Limon"]]));
    expect(s[0].field).not.toBe("client.phone");
  });
});
