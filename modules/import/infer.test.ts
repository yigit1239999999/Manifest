import { describe, expect, it } from "vitest";
import { classifyColumn, isBlank, looksLikeDate, looksLikePhone } from "./infer";

/**
 * ON THE FIXTURES BELOW, BECAUSE THIS REPO BANS MOCK DATA
 *
 * The ban is real and this file is not an exception to it -- it is the line the
 * ban actually draws. What is forbidden is inventing WHAT A TURKISH CLINIC'S
 * FILE LOOKS LIKE and then designing against the invention: that is a claim
 * about the world, made up, and every screen built on it inherits the lie.
 *
 * What these fixtures assert is a MECHANISM: given values shaped like this,
 * the classifier must say that. "A column whose values are all `dd.mm.yyyy`
 * with no part over 12 is ambiguous" is true whether or not any vet ever wrote
 * such a column. None of these rows claims to be a real clinic's data, none of
 * them is presented to a designer as evidence about the world, and no product
 * decision rests on the strings themselves.
 *
 * If you are reading this because you were about to delete these tests citing
 * the mock-data ban: the thing to check is whether a test's fixture is doing
 * the first job or the second. These do the second. A file called
 * `typical-clinic-export.xlsx` would be doing the first, and that one should go.
 *
 * WHO RUNS THE FALSIFIERS (#16 ŞART 1-4): this file runs ŞART 1 and ŞART 2's
 * content half on every `vitest` run. It does NOT run ŞART 3 (two files, two
 * writing habits) -- that needs real files from two vets and is pm's acceptance
 * when they arrive. Saying so here so that a green suite is not read as more
 * coverage than it is.
 */
describe("a column knows what it is without being told its name", () => {
  it("reads a phone in every spelling one number gets written in", () => {
    for (const written of [
      "0532 111 22 33",
      "05321112233",
      "532 111 22 33",
      "+90 532 111 22 33",
      "(0532) 111 22 33",
      "0532-111-22-33",
    ]) {
      expect(looksLikePhone(written), written).toBe(true);
    }
  });

  it("leaves a bare digit run alone, because it is not only a phone", () => {
    // A ten-digit run with no 0, no +90 and no separators could be a phone, a
    // microchip number or a price. Deciding it here would put a chip number in
    // the phone field, and the vet would never see the question.
    expect(looksLikePhone("5321112233")).toBe(false);
    expect(classifyColumn(["5321112233", "5331112233"]).kind).toBe("number");
  });

  it("reports the file's writing habit instead of tidying it away", () => {
    expect(classifyColumn(["0532 111 22 33", "0533 222 33 44"]).phoneShape).toBe("spaced");
    expect(classifyColumn(["05321112233", "05332223344"]).phoneShape).toBe("joined");
    // The vet's own file was typed by three people. A mixed column is a fact
    // about the file, not a failure of the reader.
    expect(classifyColumn(["0532 111 22 33", "05332223344"]).phoneShape).toBe("mixed");
  });
});

describe("a date column that cannot be read is SAID to be unreadable", () => {
  it("settles the order when some row settles it", () => {
    expect(classifyColumn(["14.03.2025", "02.04.2025"]).dateOrder).toBe("dayFirst");
    expect(classifyColumn(["03/14/2025", "04/02/2025"]).dateOrder).toBe("monthFirst");
    expect(classifyColumn(["2025-03-14", "2025-04-02"]).dateOrder).toBe("iso");
  });

  it("refuses to pick an order no row proves -- and says it is undecided", () => {
    // Every value parses both ways. An importer that picked one would be
    // guessing, and the vet asked for exactly the opposite: "bilmiyorum"u da
    // göstermesi, tarih uydurmaması.
    const column = classifyColumn(["03.04.2025", "05.06.2024", "01.02.2023"]);
    expect(column.kind).toBe("date");
    expect(column.dateOrder).toBe("ambiguous");
    expect(column.decidable).toBe(false);
  });

  it("calls a two-habit column ambiguous rather than splitting the difference", () => {
    // 14.03 is day-first, 03/14 is month-first, both in one column. Neither
    // order explains every row, so neither is reported.
    expect(classifyColumn(["14.03.2025", "03/14/2025", "01.02.2023"]).dateOrder).toBe("ambiguous");
  });

  it("knows a date from a number that merely has dots in it", () => {
    expect(looksLikeDate("14.03.2025")).toBe(true);
    expect(looksLikeDate("1.5")).toBe(false);
    expect(looksLikeDate("99.99.2025")).toBe(false);
  });
});

describe("the ways a file says 'nothing here'", () => {
  it("counts the markers the vet could not tell us about", () => {
    // Asked whether blanks are empty or written as something, the answer was
    // "bilmiyorum". So all of them are read as blank and REPORTED, and the
    // mapping screen can show the vet which markers its own file used.
    for (const marker of ["", "  ", "-", "—", "yok", "YOK", "Bilinmiyor", "BİLİNMİYOR", "n/a"]) {
      expect(isBlank(marker), JSON.stringify(marker)).toBe(true);
    }
    const column = classifyColumn(["0532 111 22 33", "-", "yok", "0533 222 33 44"]);
    expect(column.blankCount).toBe(2);
    expect(column.blankMarkers).toEqual(["-", "yok"]);
  });

  it("does not let blanks vote against the column's kind", () => {
    // Half the column empty is a column with gaps, not a column of mixed type.
    const column = classifyColumn(["0532 111 22 33", "-", "", "0533 222 33 44"]);
    expect(column.kind).toBe("phone");
    expect(column.agreement).toBe(1);
  });

  it("does not guess at a column with nothing in it", () => {
    expect(classifyColumn(["", "-", "yok"]).kind).toBe("empty");
  });
});

describe("what values CANNOT settle, and must not pretend to", () => {
  it("leaves every name-shaped column undecided, however tidy it looks", () => {
    // The pet and the owner are on the SAME ROW in the vet's file. Both of
    // these are text; nothing in the values says which is which -- and under
    // #19's masking both arrive as "Xxxx Xxxxx". This is the case the mapping
    // screen exists for.
    const pets = classifyColumn(["Boncuk", "Limon", "Pamuk"]);
    const owners = classifyColumn(["Ayşe Çelik", "Mehmet Yılmaz", "Zeynep Ak"]);
    expect(pets.kind).toBe("text");
    expect(owners.kind).toBe("text");
    expect(pets.decidable).toBe(false);
    expect(owners.decidable).toBe(false);
  });

  it("hands the screen the vet's own values to show back", () => {
    const column = classifyColumn(["Kedi", "Köpek", "Kedi", "Kedi/Tekir"]);
    expect(column.samples).toEqual(["Kedi", "Köpek", "Kedi/Tekir"]);
    // Few distinct values over many rows is what a category looks like -- a
    // hint for the screen to offer, never a decision taken here.
    expect(column.distinctCount).toBe(3);
  });
});
