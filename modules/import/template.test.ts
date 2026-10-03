import { describe, expect, it } from "vitest";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { autoMap, missingRequired } from "./fields";
import { analyzeRows } from "./analyze";
import { readImportFile } from "./parse";
import { buildTemplate, TEMPLATE_FIELDS } from "./template";

// The promise of the template is that a clinic which fills it in has
// nothing to map. That is only true while the labels the template writes
// and the synonyms the mapper reads agree, in both languages -- two lists
// in two files that nothing else holds together.

const catalogues = { tr, en } as const;

describe.each(["tr", "en"] as const)("the %s template", (locale) => {
  const t = catalogues[locale].import;
  const labels = Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, t.fields[f]])) as Record<
    (typeof TEMPLATE_FIELDS)[number],
    string
  >;

  it("maps every one of its own columns to the right field", async () => {
    const buffer = await buildTemplate(locale, labels, {
      title: t.template.helpTitle,
      lines: [t.template.help1],
      sheetData: t.template.sheetData,
      sheetHelp: t.template.sheetHelp,
    });
    const sheet = await readImportFile(new File([new Uint8Array(buffer)], "sablon.xlsx"));
    const mapping = autoMap(sheet.headers);
    expect(mapping).toEqual([...TEMPLATE_FIELDS]);
    expect(missingRequired(mapping)).toEqual([]);

    // And its example rows go in cleanly: one owner, two animals.
    const analysis = analyzeRows(
      sheet.rows,
      mapping,
      { clients: [], pets: [], customSpecies: [] },
      { dateOrder: null, speciesChoices: {}, today: new Date("2026-10-03T00:00:00Z") },
    );
    expect(analysis.rows.map((r) => r.status)).toEqual(["ready", "ready"]);
    expect(analysis.counts).toMatchObject({ pets: 2, newClients: 1, vaccinations: 2 });
  });
});
