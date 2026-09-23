import ExcelJS from "exceljs";

/**
 * Turning a file into rows -- while keeping the two things a naive read loses.
 *
 * THING ONE: the first row is not known to be a header.
 *
 * Every importer starts by assuming row 1 holds column names, and on the vet's
 * file that assumption is a coin flip: their sheet was written by three people
 * over years and they could not tell us what, if anything, the top row says.
 * An importer that assumes wrong eats a real animal as a set of field names --
 * a record vanishes and nothing reports it. So this does not decide. It
 * measures `headerEvidence` and the mapping screen asks.
 *
 * THING TWO: a real Excel date is NOT ambiguous, and stringifying it early
 * throws that away.
 *
 * `infer.ts` refuses to read "03.04.2025" as a day or a month because nothing
 * in the text settles it. But if the cell is a genuine Excel date, Excel
 * already settled it -- the file stores an absolute day and the ambiguity
 * never existed. Flattening every cell to a string would manufacture a
 * question the file had already answered, and the vet would be asked to
 * confirm something they cannot see. So each cell keeps WHERE ITS VALUE CAME
 * FROM, and a column of true dates is decidable while a column of date-shaped
 * text is not.
 *
 * (This is the same rule as everywhere else in the import: report what the
 * file says, ask about what it does not.)
 */

export type CellSource = "text" | "number" | "date" | "formula" | "empty";

export type Cell = {
  /** What the vet would see in the cell, as text. Never reformatted. */
  text: string;
  /** Where that text came from. `date` means Excel stored a real date. */
  source: CellSource;
};

export type SheetTable = {
  name: string;
  /** Every row, including whatever the top row is. Ragged rows are padded. */
  rows: Cell[][];
  columnCount: number;
};

const EMPTY: Cell = { text: "", source: "empty" };

function toCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return EMPTY;
  if (value instanceof Date) {
    // ISO, and `infer.ts` will read it as `iso` -- correctly, because this one
    // really is unambiguous. The vet is never asked about these.
    return { text: value.toISOString().slice(0, 10), source: "date" };
  }
  if (typeof value === "number") return { text: String(value), source: "number" };
  if (typeof value === "boolean") return { text: String(value), source: "text" };
  if (typeof value === "object") {
    // exceljs hands back objects for formulas, rich text and hyperlinks. We
    // want what the vet sees, which is the RESULT, not the machinery.
    if ("result" in value && value.result !== undefined) {
      const inner = toCell(value.result as ExcelJS.CellValue);
      return { text: inner.text, source: "formula" };
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return { text: value.richText.map((r) => r.text).join(""), source: "text" };
    }
    if ("text" in value && typeof value.text === "string") {
      return { text: value.text, source: "text" };
    }
    if ("error" in value) return EMPTY;
  }
  return { text: String(value), source: "text" };
}

/**
 * Exactly what exceljs will accept, taken from exceljs rather than guessed.
 *
 * Writing `ArrayBuffer | Buffer` here and casting at the call site compiled,
 * and was wrong in both directions: exceljs's own `writeBuffer` hands back a
 * type that is neither, so every caller had to launder it through `unknown` --
 * which is the cast that stops being checked the day the library changes.
 */
export type WorkbookBytes = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

export async function readWorkbook(data: WorkbookBytes): Promise<SheetTable[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  const sheets: SheetTable[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: Cell[][] = [];
    let columnCount = 0;
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: Cell[] = [];
      // `row.cellCount` counts to the last written cell, so a row that skips a
      // column still lines up with its neighbours.
      for (let i = 1; i <= Math.max(row.cellCount, worksheet.columnCount); i += 1) {
        cells.push(toCell(row.getCell(i).value));
      }
      columnCount = Math.max(columnCount, cells.length);
      rows.push(cells);
    });
    // Pad the short rows so column N is column N on every row. A ragged table
    // silently shifts values one column left, which reads as "the phone column
    // has names in it" three screens later.
    for (const cells of rows) {
      while (cells.length < columnCount) cells.push(EMPTY);
    }
    // Trailing fully-empty rows are Excel's, not the vet's.
    while (rows.length > 0 && rows[rows.length - 1].every((c) => c.text.trim() === "")) {
      rows.pop();
    }
    sheets.push({ name: worksheet.name, rows, columnCount });
  });
  return sheets;
}

/** How much the top row looks like names-of-columns rather than a record. */
export type HeaderEvidence = {
  /** Columns where row 0 is text but the values below are phone/date/number. */
  differsFromBody: number;
  /** Columns compared at all (a column with no body values proves nothing). */
  comparable: number;
  /** True only when every comparable column disagrees, and there is at least one. */
  looksLikeHeader: boolean;
};

/**
 * The evidence, and deliberately not the answer.
 *
 * The signal is narrow on purpose: row 0 is TEXT while the column under it is
 * something shaped -- phones, dates, numbers. "Tel" over ten phone numbers is
 * a header; "Boncuk" over ten pet names is not distinguishable from data and
 * this function says so by not counting it.
 *
 * Which means: a sheet whose columns are ALL free text gets `comparable: 0`
 * and `looksLikeHeader: false`. That is not a failure to detect a header, it
 * is the honest report that nothing here can tell. The screen asks.
 */
export function headerEvidence(rows: Cell[][]): HeaderEvidence {
  if (rows.length < 2) return { differsFromBody: 0, comparable: 0, looksLikeHeader: false };
  const [first, ...body] = rows;
  let differsFromBody = 0;
  let comparable = 0;

  for (let col = 0; col < first.length; col += 1) {
    const top = first[col];
    if (top.source !== "text" || top.text.trim() === "") continue;
    // The top cell must not have the body's shape either. A sheet with no
    // header starts with a phone number over more phone numbers, and checking
    // only the body would call that a header -- eating a real animal's record
    // as a set of field names, silently. This line is the one that saw it.
    if (looksShaped(top.text)) continue;
    const below = body.map((r) => r[col]).filter((c) => c && c.text.trim() !== "");
    if (below.length === 0) continue;
    const shaped = below.filter((c) => c.source === "date" || c.source === "number" || looksShaped(c.text));
    if (shaped.length / below.length < 0.8) continue;
    comparable += 1;
    differsFromBody += 1;
  }

  return { differsFromBody, comparable, looksLikeHeader: comparable > 0 && differsFromBody === comparable };
}

/** Text that has a shape a name would not have: a phone, a date, a number. */
function looksShaped(text: string): boolean {
  const v = text.trim();
  return /^[\d\s().+-]{7,}$/.test(v) || /^\d{1,4}[.\/-]\d{1,2}[.\/-]\d{2,4}$/.test(v) || /^-?\d+(?:[.,]\d+)?$/.test(v);
}
