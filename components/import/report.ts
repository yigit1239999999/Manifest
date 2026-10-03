import type { Analysis } from "@/modules/import/analyze";

/**
 * The skipped rows as a CSV the clinic can open, fix and upload again:
 * their own cells back, with the sheet row number and the reason first.
 *
 * Semicolons for Turkish, because Turkish Excel opens a comma file as one
 * column; a byte order mark so it reads the file as UTF-8 and keeps ş and ğ.
 */
export function skippedReport({
  analysis,
  headers,
  cells,
  reason,
  labels,
  delimiter,
}: {
  analysis: Analysis;
  headers: string[];
  cells: Record<string, string[]>;
  reason: (row: Analysis["rows"][number]) => string;
  labels: { line: string; reason: string };
  delimiter: ";" | ",";
}): string {
  const quote = (v: string) =>
    /["\n\r;,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [[labels.line, labels.reason, ...headers]];
  for (const row of analysis.rows) {
    if (row.status !== "error" && row.status !== "duplicate") continue;
    lines.push([String(row.line), reason(row), ...(cells[row.line] ?? [])]);
  }
  return "﻿" + lines.map((l) => l.map(quote).join(delimiter)).join("\r\n") + "\r\n";
}

export function download(text: string, fileName: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
