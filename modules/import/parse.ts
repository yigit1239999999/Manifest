// Bytes in, a grid of strings out.
//
// Everything is a string from here on, including numbers and dates, so the
// readers in `normalize.ts` see what the clinic typed and decide what it
// means in one place. A date cell is the exception that proves it: Excel
// stores those as numbers with a format, and the only honest string for
// one is its ISO day.

import readXlsxFile from "read-excel-file/node";
import { AppError } from "@/lib/errors";

/** Under Vercel's 4.5 MB request ceiling, with room for the form fields. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Data rows, not counting the header or blank lines. */
export const MAX_ROWS = 2000;
const MAX_COLUMNS = 60;

export type ImportErrorCode =
  | "fileMissing"
  | "fileTooLarge"
  | "fileType"
  | "xlsLegacy"
  | "fileUnreadable"
  | "fileEmpty"
  | "tooManyRows"
  | "mappingIncomplete"
  | "changedSincePreview"
  | "nothingToImport";

export const importError = (code: ImportErrorCode, vars?: Record<string, string | number>) =>
  new AppError("VALIDATION_FAILED", `import.errors.${code}`, vars, { importError: code });

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  sheetName: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // read-excel-file builds dates in UTC from the serial number.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Text of a CSV, whichever encoding Excel saved it in. Turkish Excel on
 * Windows writes "CSV" as Windows-1254, where ş and ğ are single bytes that
 * are not valid UTF-8; reading those as UTF-8 turns every Ayşe into Ay�e.
 */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}

/**
 * RFC 4180, with the delimiter read from the header line: Turkish Excel
 * separates with ";" because "," is the decimal mark.
 */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const counts = [";", ",", "\t"].map((d) => ({
    d,
    n: firstLine.split(d).length - 1,
  }));
  const delimiter = counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts[0].d : ",";

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

/**
 * The grid from its first non-empty row on: that row is the header, the
 * rest are data. Trailing empty columns are cut, so a sheet whose
 * formatting runs to column Z does not offer twenty blank columns to map.
 */
export function toSheet(grid: string[][], sheetName: string | null): ParsedSheet {
  const cells = grid.map((r) => r.map((c) => cellText(c)));
  const start = cells.findIndex((r) => r.some((c) => c !== ""));
  if (start === -1) throw importError("fileEmpty");
  const headerRow = cells[start];
  let width = 0;
  for (const r of cells.slice(start)) {
    for (let i = r.length - 1; i >= 0; i -= 1) {
      if (r[i] !== "") {
        width = Math.max(width, i + 1);
        break;
      }
    }
  }
  width = Math.min(width, MAX_COLUMNS);
  const headers = Array.from({ length: width }, (_, i) => headerRow[i] ?? "");
  const rows = cells.slice(start + 1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  // Trailing blank rows are formatting, not data.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  if (rows.length === 0) throw importError("fileEmpty");
  const filled = rows.filter((r) => r.some((c) => c !== "")).length;
  if (filled > MAX_ROWS) throw importError("tooManyRows", { count: filled, max: MAX_ROWS });
  return { headers, rows, sheetName };
}

/** Header row number in the sheet, so reasons can point at real line numbers. */
export function firstDataLine(grid: string[][]): number {
  const start = grid.findIndex((r) => r.some((c) => cellText(c) !== ""));
  return start + 2;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export async function readImportFile(
  file: File | null,
): Promise<ParsedSheet & { firstLine: number; fileName: string }> {
  if (!file || file.size === 0) throw importError("fileMissing");
  if (file.size > MAX_FILE_BYTES) throw importError("fileTooLarge", { max: 4 });

  const ext = extensionOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  // The old binary format. No maintained library reads it without
  // pulling in the abandoned `xlsx` package, and Excel converts it in two
  // clicks -- so the answer is to say how, not to half-read it.
  if (ext === "xls" || ole) throw importError("xlsLegacy");

  let grid: string[][];
  let sheetName: string | null = null;
  if (ext === "xlsx" || zip) {
    if (!zip) throw importError("fileUnreadable");
    try {
      const sheets = await readXlsxFile(Buffer.from(bytes), {
        // Numbers as written: a microchip is fifteen digits and a phone
        // starts with zero, and a float would quietly change both.
        parseNumber: (s: string) => s,
      });
      const first =
        sheets.find((s) => s.data.some((r) => r.some((c) => c !== null && String(c).trim() !== ""))) ??
        sheets[0];
      if (!first) throw importError("fileEmpty");
      sheetName = sheets.length > 1 ? first.sheet : null;
      grid = first.data.map((r) => r.map((c) => cellText(c)));
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw importError("fileUnreadable");
    }
  } else if (ext === "csv" || ext === "txt" || ext === "") {
    grid = parseCsv(decodeCsv(bytes));
  } else {
    throw importError("fileType");
  }

  const sheet = toSheet(grid, sheetName);
  return { ...sheet, firstLine: firstDataLine(grid), fileName: file.name };
}
