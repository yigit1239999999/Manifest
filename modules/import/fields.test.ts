import { describe, expect, it } from "vitest";
import { classifyColumn } from "./infer";
import { fold, propose } from "./fields";

const column = (values: string[], heading?: string) => propose(classifyColumn(values), heading);

/**
 * Fixtures build a MECHANISM, as in the other two files here: "a heading
 * cannot admit a candidate the values disallow" is true of every file, and
 * none of these rows claims to describe a real clinic's spreadsheet.
 */
describe("a heading orders candidates, it never admits one", () => {
  it("cannot turn a column of names into a phone column", () => {
    // The single most expensive thing a header-matching importer does. Their
    // file was typed by three people; a heading is a habit, not a schema.
    const pets = column(["Boncuk", "Limon", "Pamuk"], "Tel");
    expect(pets.candidates).not.toContain("client.phone");
    expect(pets.settled).toBe(false);
  });

  it("cannot turn a phone column into a name", () => {
    const phones = column(["0532 111 22 33", "0533 222 33 44"], "Hayvanın adı");
    expect(phones.candidates).not.toContain("pet.name");
  });

  it("DOES pick between two candidates the content already allows", () => {
    // Two phone-shaped columns are phone and secondaryPhone in some order,
    // and the heading is the only thing in the file that says which. Refusing
    // to read it here would be superstition, not caution.
    const first = column(["0532 111 22 33", "0533 222 33 44"], "Cep");
    const second = column(["0212 111 22 33", "0216 222 33 44"], "Ev tel");
    expect(first.candidates[0]).toBe("client.phone");
    expect(second.candidates[0]).toBe("client.secondaryPhone");
    expect(first.orderedBy).toBe("Cep");
  });

  it("folds Turkish headings the Turkish way", () => {
    // /i does not fold İ to i, and "İ".toLowerCase() is i + a combining dot
    // that matches nothing. Without this, TELEFON misses and TELEFON's column
    // arrives at the vet unordered -- one extra question per shouting header.
    expect(fold("TELEFON")).toBe("telefon");
    expect(fold("İL")).toBe("il");
    expect(fold("Şehir")).toBe("şehir");
    expect(column(["0532 111 22 33", "0533 222 33 44"], "TELEFON").orderedBy).toBe("TELEFON");
  });
});

describe("one candidate is not the same as one answer", () => {
  it("settles a column only when content leaves exactly one place for it", () => {
    // An email column can only be an email. Nothing to ask.
    const emails = column(["a@b.com", "c@d.com"]);
    expect(emails.settled).toBe(true);
    expect(emails.candidates[0]).toBe("client.email");
  });

  it("does NOT settle a phone column, because there are two phone fields", () => {
    const phones = column(["0532 111 22 33", "0533 222 33 44"]);
    expect(phones.settled).toBe(false);
    expect(phones.candidates).toContain("client.phone");
    expect(phones.candidates).toContain("client.secondaryPhone");
  });

  it("does not let a heading manufacture settledness", () => {
    // Ordering a list of two does not shorten it. If a heading could settle,
    // one confident word in row 1 would silently place a column.
    expect(column(["0532 111 22 33", "0533 222 33 44"], "Cep").settled).toBe(false);
  });

  it("does not settle a date column whose order no row proves", () => {
    // pet.birthDate is the only date target, so content leaves one candidate
    // -- but WHICH date is still unknown, and settling here would import the
    // 3rd of April as the 4th of March without ever asking.
    const provable = column(["14.03.2025", "02.04.2025"]);
    const not = column(["03.04.2025", "05.06.2024"]);
    expect(provable.candidates[0]).toBe("pet.birthDate");
    expect(provable.settled).toBe(true);
    expect(not.candidates[0]).toBe("pet.birthDate");
    expect(not.settled).toBe(false);
  });

  it("asks about every name-shaped column, all of them, every time", () => {
    // The pet and the owner are on the same row. Three text columns is three
    // questions -- and under #19's masking they are indistinguishable anyway.
    for (const values of [["Boncuk", "Limon"], ["Ayşe Çelik", "Mehmet Yılmaz"], ["Kedi", "Köpek"]]) {
      expect(column(values).settled, values.join("/")).toBe(false);
    }
  });
});

describe("the two choices that are always available", () => {
  it("offers skip on every column, last", () => {
    const c = column(["Boncuk", "Limon"]);
    expect(c.candidates.at(-1)).toBe("skip");
  });

  it("skips an empty column without calling it a question", () => {
    const empty = column(["", "-", "yok"]);
    expect(empty.candidates).toEqual(["skip"]);
    expect(empty.settled).toBe(true);
  });
});
