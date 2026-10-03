import type { Cell, SheetTable } from "./read-workbook";

/**
 * A CSV, read the way a Turkish clinic's Excel writes one.
 *
 * Two habits of Turkish Excel decide everything here, and both were in the
 * owner's own test file (`03-sekreter-listesi.csv`):
 *
 *   - "Save as CSV" on Windows writes Windows-1254, where ş, ğ and İ are
 *     single bytes that are not valid UTF-8. Read as UTF-8, every "Ayşe"
 *     becomes "Ay�e" -- in a file that is nothing but names.
 *   - The separator is ";", because "," is the decimal mark ("4,2 kg").
 *
 * Every cell is `text`: a CSV has no types, so a date in it is a date-SHAPED
 * string and goes through the same day-or-month question as typed text in
 * a workbook. That is the honest reading, not a limitation.
 */

/** UTF-8 if the bytes are valid UTF-8, Windows-1254 otherwise. */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}

/**
 * The separator, read from the first non-empty line and counted OUTSIDE
 * quotes -- a quoted address "Moda Cad. 12, Kadıköy" in a semicolon file
 * must not vote for the comma.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const counts = new Map<string, number>([[";", 0], [",", 0], ["\t", 0]]);
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let best = ",";
  let most = 0;
  for (const [delimiter, count] of counts) {
    if (count > most) {
      best = delimiter;
      most = count;
    }
  }
  return best;
}

/** RFC 4180: quotes, doubled quotes inside them, and line breaks inside them. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A CSV as the same table a workbook sheet becomes, padded and trimmed. */
export function csvSheet(name: string, bytes: Uint8Array): SheetTable {
  const grid = parseCsv(decodeCsv(bytes));
  const columnCount = grid.reduce((max, r) => Math.max(max, r.length), 0);
  const rows: Cell[][] = grid.map((r) =>
    Array.from({ length: columnCount }, (_, i) => {
      const text = r[i] ?? "";
      return { text, source: text.trim() === "" ? "empty" : "text" } as Cell;
    }),
  );
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.text.trim() === "")) rows.pop();
  return { name, rows, columnCount };
}
