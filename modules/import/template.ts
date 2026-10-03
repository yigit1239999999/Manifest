import ExcelJS from "exceljs";

/**
 * The spreadsheet a clinic can download, fill in, and import with nothing
 * to match.
 *
 * Its headings are words `fields.ts` recognises, so every column arrives
 * matched -- `template.test.ts` holds that, because a template that asks
 * questions about itself is a broken promise. Two vaccine columns named by
 * their heading, because that is how clinics write vaccines ("Kuduz Aşısı",
 * "Karma Aşı") and it is the shape the vet would not switch without.
 *
 * Phone and chip columns are TEXT (`@`). Typed into a General cell, Excel
 * drops the leading zero of "0532..." and writes a fifteen-digit chip as
 * 9.00123E+14 -- two facts destroyed before the file ever reaches us.
 */
type Locale = "tr" | "en";

const HEADINGS: Record<Locale, string[]> = {
  tr: ["Sahip Adı Soyadı", "Telefon", "E-posta", "Adres", "Hayvan Adı", "Tür", "Irk", "Cinsiyet", "Doğum Tarihi", "Çip Numarası", "Kilo (kg)", "Kuduz Aşısı", "Karma Aşı", "Notlar"],
  en: ["Owner Name", "Phone", "Email", "Address", "Pet Name", "Species", "Breed", "Sex", "Birth Date", "Chip Number", "Weight (kg)", "Rabies Vaccine", "Combination Vaccine", "Notes"],
};

const EXAMPLES: Record<Locale, Array<Array<string | number | Date | null>>> = {
  tr: [
    ["Ayşe Yılmaz", "0532 123 45 67", "ayse@ornek.com", "Moda Cad. 12, Kadıköy", "Pamuk", "Kedi", "Van kedisi", "Dişi", new Date(Date.UTC(2021, 4, 12)), "900123456789012", 3.8, new Date(Date.UTC(2026, 2, 10)), new Date(Date.UTC(2026, 2, 10)), "Taşıma çantasında sakin"],
    ["Ayşe Yılmaz", "0532 123 45 67", null, null, "Karabaş", "Köpek", "Kangal", "Erkek", new Date(Date.UTC(2019, 8, 3)), null, 48.5, new Date(Date.UTC(2026, 0, 22)), null, null],
  ],
  en: [
    ["Jane Smith", "0532 123 45 67", "jane@example.com", "12 Moda Street", "Snowball", "Cat", "Turkish Van", "Female", new Date(Date.UTC(2021, 4, 12)), "900123456789012", 3.8, new Date(Date.UTC(2026, 2, 10)), new Date(Date.UTC(2026, 2, 10)), "Calm in the carrier"],
    ["Jane Smith", "0532 123 45 67", null, null, "Max", "Dog", "Kangal", "Male", new Date(Date.UTC(2019, 8, 3)), null, 48.5, new Date(Date.UTC(2026, 0, 22)), null, null],
  ],
};

/** Columns whose cells must stay text: the phone and the chip. */
const TEXT_COLUMNS = [2, 10];
const DATE_COLUMNS = [9, 12, 13];

export async function buildTemplate(locale: Locale, sheetName: string): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  const headings = HEADINGS[locale];
  sheet.addRow(headings).font = { bold: true };
  for (const row of EXAMPLES[locale]) sheet.addRow(row);
  headings.forEach((heading, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = Math.max(14, heading.length + 4);
    if (TEXT_COLUMNS.includes(i + 1)) column.numFmt = "@";
    if (DATE_COLUMNS.includes(i + 1)) column.numFmt = "dd.mm.yyyy";
  });
  // The format has to be on the empty rows the clinic will type into, not
  // only on the examples: a column format reaches new cells, so it is set
  // on the column above; the examples carry it explicitly as well.
  for (let r = 2; r <= 3; r += 1) {
    for (const c of TEXT_COLUMNS) sheet.getCell(r, c).numFmt = "@";
  }
  return workbook.xlsx.writeBuffer();
}

export { HEADINGS as TEMPLATE_HEADINGS };
