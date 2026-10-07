/**
 * A CSV an accountant opens in Excel and sees columns, not one long line.
 *
 * Semicolon-separated, with a UTF-8 byte-order mark: Turkish Excel uses
 * ";" as its list separator (the comma is the decimal mark there), and
 * without the BOM it reads "Ödeme" as "Ã–deme". Amounts are written with
 * the locale's decimal mark and no grouping, so they arrive as numbers.
 */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** Cents as the plain number a spreadsheet reads: "1234,50" in Turkish. */
export function csvAmount(cents: number, locale: string): string {
  const fixed = (cents / 100).toFixed(2);
  return locale === "tr" ? fixed.replace(".", ",") : fixed;
}
