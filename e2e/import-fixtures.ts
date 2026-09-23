// Spreadsheets to try the import screen with, built rather than collected.
//
// No real file exists: the vet declined to send one and the reason is the
// requirement (#16) -- "if I give you five rows I will have made them up; what
// you are asking for is the FORMAT, and that is the thing I cannot invent".
// So these are not a guess at what a Turkish clinic's export looks like. Each
// one is named after the MECHANISM it exercises, and that name is the whole
// rule: `typical-clinic-export.xlsx` would be a claim about the world nobody
// here is entitled to make, while "the first row is a record, not headings"
// is a proposition that is true whether or not any clinic ever wrote such a
// file. The same line is drawn at the top of `modules/import/infer.test.ts`.
//
//   node scripts/make-import-fixtures.ts [directory]
//
// Writes into `tmp/import-fixtures` by default (gitignored) and prints what
// each file is for.
//
// Two files, and the split is forced rather than chosen. Playwright compiles
// what is under its test directory and loads it through `require`; a module
// containing `import.meta` cannot be CommonJS, so the whole file came back as
// an ES module in a CommonJS scope and the spec died on its import line
// before a test ran. So the command-line half lives in
// `scripts/make-import-fixtures.ts` and this half stays importable.
// `testMatch` is `*.spec.ts`, so this is never collected as a test.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

async function book(build: (wb: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return workbook.xlsx.writeBuffer();
}

const rows = (sheet: ExcelJS.Worksheet, values: unknown[][]) =>
  values.forEach((row) => sheet.addRow(row));

/** Each entry: the mechanism, and the sheet that exercises it. */
export const FIXTURES = [
  {
    name: "header-row-is-names.xlsx",
    exercises:
      "row 1 is text over shaped values, so headerEvidence can compare and the screen can propose 'column names'",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Kayitlar");
      rows(s, [
        ["Adı", "Sahibi", "Tel", "Doğum"],
        ["Boncuk", "Ayşe Yılmaz", "0532 111 22 33", new Date("2019-04-03")],
        ["Pamuk", "Mehmet Demir", "0533 444 55 66", new Date("2021-11-17")],
        ["Zeytin", "Ayşe Yılmaz", "0532 111 22 33", new Date("2020-01-09")],
      ]);
    },
  },
  {
    name: "first-row-is-a-record.xlsx",
    exercises:
      "no headings at all: row 1 is a real animal, and an importer that assumes otherwise eats it silently",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Sayfa1");
      rows(s, [
        ["Boncuk", "Ayşe Yılmaz", "0532 111 22 33"],
        ["Pamuk", "Mehmet Demir", "0533 444 55 66"],
        ["Zeytin", "Ayşe Yılmaz", "0532 111 22 33"],
      ]);
    },
  },
  {
    name: "all-text-no-comparable.xlsx",
    exercises:
      "every column is free text, so comparable is 0: nothing in the file can tell a heading from a record and the screen must say so",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Sayfa1");
      rows(s, [
        ["Adı", "Irkı", "Rengi"],
        ["Boncuk", "Tekir", "Sarı"],
        ["Pamuk", "Van kedisi", "Beyaz"],
      ]);
    },
  },
  {
    name: "date-shaped-text-ambiguous.xlsx",
    exercises:
      "dates written as TEXT with no part over 12, which nothing can settle: the screen asks day-first or month-first",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Sayfa1");
      rows(s, [
        ["Adı", "Doğum"],
        ["Boncuk", "03.04.2025"],
        ["Pamuk", "05.06.2024"],
        ["Zeytin", "11.12.2023"],
      ]);
    },
  },
  {
    name: "blanks-written-three-ways.xlsx",
    exercises:
      "'-', 'yok' and an actually empty cell all mean the same thing, and the screen reports the count back",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Sayfa1");
      rows(s, [
        ["Adı", "Tel"],
        ["Boncuk", "0532 111 22 33"],
        ["Pamuk", "-"],
        ["Zeytin", "yok"],
        ["Kömür", ""],
      ]);
    },
  },
  {
    name: "two-sheets.xlsx",
    exercises: "more than one sheet, so the screen has to ask which one",
    build: (wb: ExcelJS.Workbook) => {
      const a = wb.addWorksheet("2023");
      rows(a, [["Adı", "Tel"], ["Boncuk", "0532 111 22 33"]]);
      const b = wb.addWorksheet("2024");
      rows(b, [["Adı", "Tel"], ["Pamuk", "0533 444 55 66"]]);
    },
  },
  {
    name: "five-hundred-rows.xlsx",
    exercises:
      "the scale the screen is measured at: 500 rows x 8 columns, held in the browser as state",
    build: (wb: ExcelJS.Workbook) => {
      const s = wb.addWorksheet("Sayfa1");
      s.addRow(["Adı", "Sahibi", "Tel", "Doğum", "Irk", "Renk", "Kilo", "Not"]);
      for (let i = 0; i < 500; i += 1) {
        s.addRow([
          `Hayvan ${i}`,
          `Sahip ${i}`,
          `053${i % 10} 111 22 33`,
          new Date(2020, i % 12, (i % 27) + 1),
          "Tekir",
          "Sarı",
          String(3 + (i % 20)),
          "",
        ]);
      }
    },
  },
];

export async function writeFixtures(dir: string) {
  await mkdir(dir, { recursive: true });
  const written: Array<{ name: string; exercises: string; file: string; bytes: number }> = [];
  for (const fixture of FIXTURES) {
    const bytes = await book(fixture.build);
    const file = path.join(dir, fixture.name);
    await writeFile(file, Buffer.from(bytes));
    written.push({ ...fixture, file, bytes: bytes.byteLength });
  }

  // One file that exists only to be refused. The size limit is the one part
  // of this screen that fails silently if it is wrong -- a request that dies
  // on the way out looks like nothing at all -- so there is a file that
  // crosses it on purpose. Incompressible bytes, or a zip of zeroes would
  // sail under the limit.
  const big = path.join(dir, "over-the-size-limit.xlsx");
  const filler = Buffer.alloc(9 * 1024 * 1024);
  for (let i = 0; i < filler.length; i += 1) filler[i] = (i * 2654435761) % 256;
  await writeFile(big, filler);
  written.push({
    name: "over-the-size-limit.xlsx",
    exercises: "over MAX_IMPORT_BYTES, so the limit has to say so out loud",
    file: big,
    bytes: filler.length,
  });

  return written;
}

// The scale number the screen's comment carries, measured rather than printed
// here: `readWorkbook` is TypeScript and reproducing this takes the runner:
//
//   readWorkbook(five-hundred-rows.xlsx) -> JSON.stringify -> 136.6 KB
//   (501 rows x 8 columns, 23 September 2026)
//
// That is what crosses the wire once and sits in browser state once.
