import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { decodeCsv, parseCsv, readImportFile, toSheet } from "./parse";

const file = (bytes: Uint8Array<ArrayBuffer> | string, name: string) =>
  new File([typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes], name);

async function refusal(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof AppError) return e.details?.importError as string;
    throw e;
  }
  return undefined;
}

describe("CSV", () => {
  it("reads the semicolon Turkish Excel writes, with quotes and line breaks", () => {
    const text = 'Sahip;Hayvan;Not\n"Yılmaz; Ayşe";Pamuk;"iki\nsatır"\r\nAli Kaya;"Tekir ""Minik""";\n';
    expect(parseCsv(text)).toEqual([
      ["Sahip", "Hayvan", "Not"],
      ["Yılmaz; Ayşe", "Pamuk", "iki\nsatır"],
      ["Ali Kaya", 'Tekir "Minik"', ""],
    ]);
  });

  it("reads a comma file as a comma file", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("decodes Windows-1254 when the bytes are not UTF-8", () => {
    // "Ayşe Güneş" as Turkish Windows Excel saves it.
    const bytes = new Uint8Array([0x41, 0x79, 0xfe, 0x65, 0x20, 0x47, 0xfc, 0x6e, 0x65, 0xfe]);
    expect(decodeCsv(bytes)).toBe("Ayşe Güneş");
  });

  it("drops a UTF-8 byte order mark from the first header", () => {
    expect(decodeCsv(new TextEncoder().encode("﻿Sahip"))).toBe("Sahip");
  });
});

describe("toSheet", () => {
  it("starts at the first non-empty row and trims trailing empty columns and rows", () => {
    const sheet = toSheet(
      [
        ["", "", ""],
        ["Sahip", "Hayvan", ""],
        ["Ayşe Yılmaz", "Pamuk", ""],
        ["", "", ""],
      ],
      null,
    );
    expect(sheet.headers).toEqual(["Sahip", "Hayvan"]);
    expect(sheet.rows).toEqual([["Ayşe Yılmaz", "Pamuk"]]);
  });

  it("refuses a header with nothing under it", () => {
    expect(() => toSheet([["Sahip", "Hayvan"]], null)).toThrowError(AppError);
  });
});

describe("readImportFile", () => {
  it("explains the old .xls format instead of half-reading it", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await refusal(readImportFile(file(ole, "liste.xls")))).toBe("xlsLegacy");
    // Renamed to .xlsx, still the old format inside.
    expect(await refusal(readImportFile(file(ole, "liste.xlsx")))).toBe("xlsLegacy");
  });

  it("refuses other file types, empty uploads and files over the limit", async () => {
    expect(await refusal(readImportFile(file("x", "foto.png")))).toBe("fileType");
    expect(await refusal(readImportFile(null))).toBe("fileMissing");
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    expect(await refusal(readImportFile(file(big, "buyuk.csv")))).toBe("fileTooLarge");
  });

  it("reports the sheet line of the first data row", async () => {
    const sheet = await readImportFile(file("\n\nSahip;Hayvan\nAyşe Yılmaz;Pamuk\n", "liste.csv"));
    expect(sheet.firstLine).toBe(4);
    expect(sheet.rows).toEqual([["Ayşe Yılmaz", "Pamuk"]]);
  });
});
