import { describe, expect, it } from "vitest";
import { csvSheet, decodeCsv, detectDelimiter, parseCsv } from "./read-csv";

describe("a CSV the way Turkish Excel writes one", () => {
  it("reads Windows-1254 when the bytes are not UTF-8", () => {
    // "Ayşe;Şeker" in Windows-1254: ş = 0xFE, Ş = 0xDE.
    const bytes = new Uint8Array([0x41, 0x79, 0xfe, 0x65, 0x3b, 0xde, 0x65, 0x6b, 0x65, 0x72]);
    expect(decodeCsv(bytes)).toBe("Ayşe;Şeker");
  });

  it("reads UTF-8 and drops the byte-order mark", () => {
    const bytes = new TextEncoder().encode("﻿Ayşe;Pamuk");
    expect(decodeCsv(bytes)).toBe("Ayşe;Pamuk");
  });

  it("takes the separator from the first line, outside quotes", () => {
    expect(detectDelimiter("Sahibi;Tel;Hayvan\n")).toBe(";");
    expect(detectDelimiter('"Moda Cad. 12, Kadıköy";Ayşe;Pamuk')).toBe(";");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });

  it("keeps quoted separators, doubled quotes and line breaks inside a cell", () => {
    expect(parseCsv('a;"b;c";"say ""hi""";"x\ny"\r\n1;2;3;4', ";")).toEqual([
      ["a", "b;c", 'say "hi"', "x\ny"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("pads short rows and drops trailing empty lines", () => {
    const sheet = csvSheet("liste", new TextEncoder().encode("A;B;C\n1;2\n\n"));
    expect(sheet.columnCount).toBe(3);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1][2]).toEqual({ text: "", source: "empty" });
  });
});
