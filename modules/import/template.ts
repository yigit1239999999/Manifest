// The spreadsheet a clinic can download and fill in.
//
// Its headers are the field labels the mapping step shows, so a filled-in
// template maps itself with nothing to choose (`template.test.ts` holds
// that). Two example rows, one owner with two animals, because "the owner
// repeats on every line" is the one rule of the format that is not obvious.

import writeXlsxFile from "write-excel-file/node";
import type { ImportField } from "./fields";

export const TEMPLATE_FIELDS = [
  "ownerName",
  "phone",
  "email",
  "address",
  "city",
  "ownerNotes",
  "petName",
  "species",
  "breed",
  "sex",
  "birthDate",
  "color",
  "microchip",
  "neutered",
  "weight",
  "petNotes",
  "vaccineName",
  "vaccineDate",
  "vaccineNextDue",
] as const satisfies readonly ImportField[];

type TemplateField = (typeof TEMPLATE_FIELDS)[number];
type Example = Record<TemplateField, string | number>;

/**
 * Example data, not interface copy: these are what a clinic's own rows
 * look like, in the clinic's language, and they are meant to be typed
 * over. Dates are written with dots because that is the one form nobody
 * can misread.
 */
const EXAMPLES: Record<"tr" | "en", Example[]> = {
  tr: [
    {
      ownerName: "Ayşe Yılmaz",
      phone: "0532 123 45 67",
      email: "ayse.yilmaz@ornek.com",
      address: "Moda Cad. No: 12, Kadıköy",
      city: "İstanbul",
      ownerNotes: "Akşamları aranmayı tercih ediyor",
      petName: "Pamuk",
      species: "Kedi",
      breed: "Van kedisi",
      sex: "Dişi",
      birthDate: "12.05.2021",
      color: "Beyaz",
      microchip: "900123456789012",
      neutered: "Evet",
      weight: 3.8,
      petNotes: "Taşıma çantasında sakin",
      vaccineName: "Karma aşı",
      vaccineDate: "10.03.2026",
      vaccineNextDue: "10.03.2027",
    },
    {
      ownerName: "Ayşe Yılmaz",
      phone: "0532 123 45 67",
      email: "",
      address: "",
      city: "",
      ownerNotes: "",
      petName: "Karabaş",
      species: "Köpek",
      breed: "Kangal",
      sex: "Erkek",
      birthDate: "03.09.2019",
      color: "Krem, siyah maske",
      microchip: "",
      neutered: "Hayır",
      weight: 48.5,
      petNotes: "",
      vaccineName: "Kuduz",
      vaccineDate: "22.01.2026",
      vaccineNextDue: "22.01.2027",
    },
  ],
  en: [
    {
      ownerName: "Jane Smith",
      phone: "0532 123 45 67",
      email: "jane.smith@example.com",
      address: "12 Moda Street, Kadıköy",
      city: "Istanbul",
      ownerNotes: "Prefers calls in the evening",
      petName: "Snowball",
      species: "Cat",
      breed: "Turkish Van",
      sex: "Female",
      birthDate: "12.05.2021",
      color: "White",
      microchip: "900123456789012",
      neutered: "Yes",
      weight: 3.8,
      petNotes: "Calm in the carrier",
      vaccineName: "Combination vaccine",
      vaccineDate: "10.03.2026",
      vaccineNextDue: "10.03.2027",
    },
    {
      ownerName: "Jane Smith",
      phone: "0532 123 45 67",
      email: "",
      address: "",
      city: "",
      ownerNotes: "",
      petName: "Max",
      species: "Dog",
      breed: "Kangal",
      sex: "Male",
      birthDate: "03.09.2019",
      color: "Cream, black mask",
      microchip: "",
      neutered: "No",
      weight: 48.5,
      petNotes: "",
      vaccineName: "Rabies",
      vaccineDate: "22.01.2026",
      vaccineNextDue: "22.01.2027",
    },
  ],
};

export async function buildTemplate(
  locale: "tr" | "en",
  labels: Record<TemplateField, string>,
  help: { title: string; lines: string[]; sheetData: string; sheetHelp: string },
): Promise<Buffer> {
  const header = TEMPLATE_FIELDS.map((f) => ({
    value: labels[f],
    fontWeight: "bold" as const,
    backgroundColor: "#E6F3F0",
  }));
  const rows = EXAMPLES[locale].map((example) =>
    TEMPLATE_FIELDS.map((f) => {
      const value = example[f];
      return typeof value === "number"
        ? { value, type: Number, format: "0.0" }
        : { value, type: String };
    }),
  );

  return writeXlsxFile(
    [
      {
        data: [header, ...rows],
        sheet: help.sheetData,
        columns: TEMPLATE_FIELDS.map((f) => ({
          width: Math.max(12, labels[f].length + 4, ...EXAMPLES[locale].map((e) => String(e[f]).length + 2)),
        })),
        stickyRowsCount: 1,
      },
      {
        data: [
          [{ value: help.title, fontWeight: "bold" as const }],
          [],
          ...help.lines.map((line) => [{ value: line, type: String }]),
        ],
        sheet: help.sheetHelp,
        columns: [{ width: 110 }],
      },
    ],
    {},
  ).toBuffer();
}
