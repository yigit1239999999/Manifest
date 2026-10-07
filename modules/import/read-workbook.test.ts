import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { headerEvidence, readWorkbook, type Cell, type WorkbookBytes } from "./read-workbook";
import { classifyColumn } from "./infer";

/**
 * The fixtures here are BUILT, not collected -- same line as infer.test.ts.
 *
 * Each workbook below exists to exercise one mechanism of the reader: a real
 * date cell versus date-shaped text, a row that skips a column, a sheet with
 * no header. None of them claims to be what a clinic's file looks like, and no
 * design decision rests on the strings. The banned thing is a fixture named
 * "what vets actually send us"; these are named after the mechanism instead.
 */
async function workbook(sheets: Record<string, unknown[][]>): Promise<WorkbookBytes> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const row of rows) ws.addRow(row);
  }
  return wb.xlsx.writeBuffer();
}

const text = (row: Cell[]) => row.map((c) => c.text);

describe("a file becomes rows without losing what Excel already knew", () => {
  it("keeps a real date apart from text that merely looks like one", async () => {
    // This is the whole reason cells carry their source. Both columns read
    // '03.04.2025'-ish to a human. Only one of them is a question.
    const file = await workbook({
      Sayfa1: [
        ["gerçek", "metin"],
        [new Date(Date.UTC(2025, 3, 3)), "03.04.2025"],
        [new Date(Date.UTC(2024, 5, 5)), "05.06.2024"],
      ],
    });
    const [sheet] = await readWorkbook(file);

    const real = sheet.rows.slice(1).map((r) => r[0]);
    const written = sheet.rows.slice(1).map((r) => r[1]);
    expect(real.every((c) => c.source === "date")).toBe(true);
    expect(written.every((c) => c.source === "text")).toBe(true);

    // And the consequence, which is the point: Excel settled the first column,
    // so nobody is asked about it. Nothing settled the second.
    expect(classifyColumn(real.map((c) => c.text)).decidable).toBe(true);
    expect(classifyColumn(written.map((c) => c.text)).dateOrder).toBe("ambiguous");
  });

  it("lines up a row that skips a column instead of shifting it left", async () => {
    // A ragged row is how the phone column quietly acquires names. Padding is
    // not tidiness here; it is the difference between a gap and a wrong fact.
    const file = await workbook({
      Sayfa1: [
        ["a", "b", "c"],
        ["1", null, "3"],
        ["4"],
      ],
    });
    const [sheet] = await readWorkbook(file);
    expect(sheet.columnCount).toBe(3);
    expect(text(sheet.rows[1])).toEqual(["1", "", "3"]);
    expect(text(sheet.rows[2])).toEqual(["4", "", ""]);
  });

  it("shows a formula's result, because that is what the vet sees", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sayfa1");
    ws.addRow(["x"]);
    ws.getCell("A2").value = { formula: "A1", result: "Boncuk" };
    const [sheet] = await readWorkbook(await wb.xlsx.writeBuffer());
    expect(sheet.rows[1][0].text).toBe("Boncuk");
    expect(sheet.rows[1][0].source).toBe("formula");
  });

  it("reads every sheet, because 'tek sayfa sanıyorum' was a guess", async () => {
    // Asked whether vaccinations live on a second sheet, the answer was "tek
    // sayfa sanıyorum ama bu tahmin". So the reader never assumes one.
    const file = await workbook({ Hayvanlar: [["a"]], Asilar: [["b"]] });
    const sheets = await readWorkbook(file);
    expect(sheets.map((s) => s.name)).toEqual(["Hayvanlar", "Asilar"]);
  });
});

describe("whether the top row is a header is EVIDENCE, never an assumption", () => {
  it("sees a header when text sits over columns that have a shape", async () => {
    const file = await workbook({
      Sayfa1: [
        ["Tel", "Tarih"],
        ["0532 111 22 33", "14.03.2025"],
        ["0533 222 33 44", "02.04.2025"],
      ],
    });
    const [sheet] = await readWorkbook(file);
    const evidence = headerEvidence(sheet.rows);
    expect(evidence.comparable).toBe(2);
    expect(evidence.looksLikeHeader).toBe(true);
  });

  it("does NOT see a header when the top row is just the first record", async () => {
    // Row 0 is a phone, same as every row under it. An importer that assumed a
    // header here would eat this animal's owner and report nothing.
    const file = await workbook({
      Sayfa1: [
        ["0532 111 22 33", "14.03.2025"],
        ["0533 222 33 44", "02.04.2025"],
      ],
    });
    const [sheet] = await readWorkbook(file);
    expect(headerEvidence(sheet.rows).looksLikeHeader).toBe(false);
  });

  it("says 'cannot tell' for an all-text sheet instead of picking", async () => {
    // Names over names. There is no signal, and the honest output is zero
    // comparable columns -- not a 50/50 guess dressed as a detection.
    const file = await workbook({
      Sayfa1: [
        ["Hayvan", "Sahibi"],
        ["Boncuk", "Ayşe Çelik"],
        ["Limon", "Mehmet Yılmaz"],
      ],
    });
    const [sheet] = await readWorkbook(file);
    const evidence = headerEvidence(sheet.rows);
    expect(evidence.comparable).toBe(0);
    expect(evidence.looksLikeHeader).toBe(false);
  });
});

describe("the header check and the column reader agree on what has a shape", () => {
  it("calls a column shaped exactly when the reader gives it a non-text kind", async () => {
    // The property, not the implementation. This file once owned its own
    // regexes for "phone shaped" and infer.ts owned others; both were right
    // the day they were written, and nothing would have failed when they
    // drifted -- they would simply have begun answering differently, and the
    // header question would have started arguing with the column proposal in
    // front of the vet. So the agreement itself is what is pinned.
    const columns = [
      { values: ["0532 111 22 33", "0533 222 33 44"], shaped: true },
      { values: ["14.03.2025", "02.04.2025"], shaped: true },
      { values: ["12", "7"], shaped: true },
      { values: ["Boncuk", "Limon"], shaped: false },
      { values: ["Kedi/Tekir", "Köpek"], shaped: false },
      { values: ["((((((( ", ")))))))"], shaped: false },
    ];

    for (const { values, shaped } of columns) {
      // Read through the header check: a heading over these values counts as a
      // heading only when the values below have a shape.
      const file = await workbook({ Sayfa1: [["Başlık"], ...values.map((v) => [v])] });
      const [sheet] = await readWorkbook(file);
      expect(headerEvidence(sheet.rows).comparable, values.join("/")).toBe(shaped ? 1 : 0);

      // And the reader must have reached the same verdict independently.
      expect(classifyColumn(values).kind !== "text", values.join("/")).toBe(shaped);
    }
  });
});
