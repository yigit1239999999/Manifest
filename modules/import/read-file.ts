import { csvSheet } from "./read-csv";
import type { SheetTable } from "./read-workbook";

/**
 * Turning the file the vet picked into tables, in the browser.
 *
 * In the browser, and that is the whole of the size story: the file never
 * crosses the network, so there is no upload to be too large. What crosses
 * is the rows the vet is importing, compressed (`limits.ts`). exceljs is
 * loaded only when a workbook is picked -- it is large, and a vet who never
 * imports never downloads it.
 *
 * Recognised by its BYTES rather than its name: a workbook is a zip ("PK"),
 * the old binary .xls is an OLE container, and anything else is read as
 * text. A file called "liste.xls" that is really a CSV -- which is what a
 * lot of old clinic software exports -- reads, and a real .xls gets the
 * sentence that says how to convert it instead of a garbled table.
 */
export type ReadFailure = "unreadable" | "legacyXls";

export class ReadFileError extends Error {
  constructor(public readonly reason: ReadFailure) {
    super(reason);
  }
}

export async function readImportFile(file: File): Promise<SheetTable[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new ReadFileError("unreadable");
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (ole) throw new ReadFileError("legacyXls");
  if (zip) {
    try {
      const { readWorkbook } = await import("./read-workbook");
      return await readWorkbook(bytes.buffer as ArrayBuffer);
    } catch {
      throw new ReadFileError("unreadable");
    }
  }
  // Text. A binary file that is neither of the above decodes to noise with
  // control characters in it, and that is "unreadable", not a table.
  const head = bytes.subarray(0, 4096);
  const controls = head.filter((b) => b < 9 || (b > 13 && b < 32)).length;
  if (controls > head.length * 0.05) throw new ReadFileError("unreadable");
  const sheet = csvSheet(file.name.replace(/\.[^.]+$/, ""), bytes);
  return [sheet];
}
