import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildTemplate } from "./template";
import { readWorkbook } from "./read-workbook";
import { classifyColumn, isBlank } from "./infer";
import { suggestMapping } from "./fields";

describe("the downloadable template", () => {
  for (const locale of ["tr", "en"] as const) {
    it(`matches every one of its own columns (${locale})`, async () => {
      const buffer = await buildTemplate(locale, "Kayıtlar");
      const [sheet] = await readWorkbook(buffer as ArrayBuffer);
      const [head, ...body] = sheet.rows;
      const columns = head.map((h, col) => {
        const values = body.map((r) => r[col]?.text ?? "");
        return { col, heading: h.text, evidence: classifyColumn(values), values: values.filter((v) => !isBlank(v)) };
      });
      const suggestions = suggestMapping(columns);
      expect(suggestions.filter((s) => s.confidence !== "recognized").map((s) => head[s.col].text)).toEqual([]);
      expect(suggestions.filter((s) => s.field === "vaccine.column")).toHaveLength(2);
    });
  }

  it("keeps the phone and chip columns as text, so Excel keeps their digits", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildTemplate("tr", "Kayıtlar")) as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell(2, 2).numFmt).toBe("@");
    expect(sheet.getCell(2, 10).numFmt).toBe("@");
    expect(sheet.getCell(2, 2).value).toBe("0532 123 45 67");
  });
});
