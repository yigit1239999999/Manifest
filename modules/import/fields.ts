// What a row of an imported spreadsheet can say, and how a column header is
// recognised as saying it.
//
// One row is one animal with its owner beside it, because that is the shape
// both hand-kept sheets and old clinic software exports actually have: the
// owner repeats on every line that holds one of their animals. Splitting it
// into an owners sheet and an animals sheet would be tidier and is not what
// anybody has on their disk.

import { fold } from "@/lib/search";

export const IMPORT_FIELDS = [
  "ownerName",
  "ownerFirstName",
  "ownerLastName",
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
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Which group a field is listed under in the mapping step. */
export const FIELD_GROUP: Record<ImportField, "owner" | "pet" | "vaccine"> = {
  ownerName: "owner",
  ownerFirstName: "owner",
  ownerLastName: "owner",
  phone: "owner",
  email: "owner",
  address: "owner",
  city: "owner",
  ownerNotes: "owner",
  petName: "pet",
  species: "pet",
  breed: "pet",
  sex: "pet",
  birthDate: "pet",
  color: "pet",
  microchip: "pet",
  neutered: "pet",
  weight: "pet",
  petNotes: "pet",
  vaccineName: "vaccine",
  vaccineDate: "vaccine",
  vaccineNextDue: "vaccine",
};

/**
 * Header spellings per field, already in the folded form `headerKey`
 * produces: lower case, Turkish letters folded, punctuation as spaces.
 *
 * Turkish first because the sheets are, English because old software
 * exports often are. "Cins" is a breed here and not a species: that is how
 * Turkish vet records use it ("Cinsi: Golden"), and reading it as species
 * would turn every golden retriever into a new species called "Golden".
 */
const SYNONYMS: Record<ImportField, readonly string[]> = {
  ownerName: [
    "sahip",
    "sahibi",
    "sahip adi",
    "sahip adi soyadi",
    "sahip ad soyad",
    "sahip ad soyadi",
    "sahibin adi",
    "musteri",
    "musteri adi",
    "musteri adi soyadi",
    "musteri ad soyad",
    "hayvan sahibi",
    "ad soyad",
    "adi soyadi",
    "ad soyadi",
    "isim soyisim",
    "owner",
    "owner name",
    "client",
    "client name",
    "customer",
    "customer name",
    "full name",
    "owner full name",
  ],
  ownerFirstName: ["ad", "adi", "isim", "first name", "firstname", "given name"],
  ownerLastName: [
    "soyad",
    "soyadi",
    "soyisim",
    "sahip soyadi",
    "musteri soyadi",
    "last name",
    "lastname",
    "surname",
    "family name",
  ],
  phone: [
    "telefon",
    "tel",
    "tel no",
    "telefon no",
    "telefon numarasi",
    "cep",
    "cep no",
    "cep tel",
    "cep telefonu",
    "gsm",
    "mobil",
    "sahip telefon",
    "sahip telefonu",
    "musteri telefon",
    "musteri telefonu",
    "phone",
    "phone number",
    "mobile",
    "cell",
    "telephone",
  ],
  email: [
    "e posta",
    "eposta",
    "e posta adresi",
    "mail",
    "email",
    "e mail",
    "email address",
  ],
  address: ["adres", "ev adresi", "acik adres", "address"],
  city: ["il", "sehir", "city"],
  ownerNotes: [
    "sahip notu",
    "sahip notlari",
    "musteri notu",
    "musteri notlari",
    "owner notes",
    "client notes",
  ],
  petName: [
    "hayvan",
    "hayvan adi",
    "hayvanin adi",
    "evcil hayvan",
    "evcil hayvan adi",
    "hasta adi",
    "pet",
    "pet name",
    "patient",
    "patient name",
    "animal",
    "animal name",
  ],
  species: [
    "tur",
    "turu",
    "hayvan turu",
    "tur adi",
    "tip",
    "species",
    "animal type",
    "pet type",
  ],
  breed: ["irk", "irki", "cins", "cinsi", "breed"],
  sex: ["cinsiyet", "cinsiyeti", "sex", "gender"],
  birthDate: [
    "dogum tarihi",
    "dogum",
    "d tarihi",
    "birth date",
    "birthdate",
    "date of birth",
    "dob",
    "birthday",
  ],
  color: ["renk", "rengi", "renk desen", "renk ve desen", "color", "colour"],
  microchip: [
    "cip",
    "cip no",
    "cip numarasi",
    "mikrocip",
    "mikrocip no",
    "mikrocip numarasi",
    "microchip",
    "microchip id",
    "microchip no",
    "microchip number",
    "chip",
    "chip no",
  ],
  neutered: [
    "kisir",
    "kisirlastirilmis",
    "kisirlastirildi",
    "kisirlastirildi mi",
    "kisirlastirma",
    "kastre",
    "kastrasyon",
    "neutered",
    "spayed",
    "spayed neutered",
    "sterilized",
  ],
  weight: ["kilo", "kilo kg", "agirlik", "agirlik kg", "weight", "weight kg"],
  petNotes: [
    "not",
    "notlar",
    "notu",
    "aciklama",
    "hayvan notu",
    "hayvan notlari",
    "notes",
    "note",
    "pet notes",
  ],
  vaccineName: [
    "asi",
    "asi adi",
    "son asi",
    "son asi adi",
    "son yapilan asi",
    "vaccine",
    "vaccine name",
    "last vaccine",
  ],
  vaccineDate: [
    "asi tarihi",
    "son asi tarihi",
    "asilama tarihi",
    "vaccine date",
    "last vaccine date",
    "vaccination date",
  ],
  vaccineNextDue: [
    "sonraki asi",
    "sonraki asi tarihi",
    "sonraki doz",
    "sonraki doz tarihi",
    "asi hatirlatma",
    "asi hatirlatma tarihi",
    "next due",
    "next due date",
    "next vaccine",
    "next vaccine date",
    "next vaccination",
  ],
};

/** "Doğum Tarihi (gg.aa.yyyy)" → "dogum tarihi gg aa yyyy". */
export function headerKey(header: string): string {
  return fold(header)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const EXACT = 100;

/**
 * How strongly a header reads as a field: exact spelling beats a header
 * that merely contains a synonym's words, and a longer synonym beats a
 * shorter one ("Son Aşı Tarihi" is a vaccine date, not a vaccine name).
 */
function score(key: string, field: ImportField): number {
  if (!key) return 0;
  const tokens = new Set(key.split(" "));
  let best = 0;
  for (const synonym of SYNONYMS[field]) {
    if (synonym === key) return EXACT;
    const words = synonym.split(" ");
    // A one-letter-ish synonym ("il", "ad", "tel") inside a longer header
    // is noise more often than signal: "Ad" is in "Hayvan Adı" too.
    if (words.length === 1 && synonym.length < 4) continue;
    if (words.every((w) => tokens.has(w))) best = Math.max(best, words.length);
  }
  return best;
}

/** Column index → field, or null for a column that is not imported. */
export type ColumnMapping = (ImportField | null)[];

/**
 * The mapping a person would most likely pick, from header text alone.
 *
 * Each field goes to at most one column, the one that reads most like it;
 * a tie goes to the column further left, which is the one a person reads
 * first. Anything unrecognised is left unmapped rather than guessed: an
 * unused column costs a click in the next step, a wrongly used one writes
 * a phone number into the notes.
 */
export function autoMap(headers: readonly string[]): ColumnMapping {
  const keys = headers.map(headerKey);
  const candidates: { column: number; field: ImportField; score: number }[] = [];
  keys.forEach((key, column) => {
    for (const field of IMPORT_FIELDS) {
      const s = score(key, field);
      if (s > 0) candidates.push({ column, field, score: s });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.column - b.column);

  const mapping: ColumnMapping = headers.map(() => null);
  const used = new Set<ImportField>();
  for (const c of candidates) {
    if (used.has(c.field) || mapping[c.column] !== null) continue;
    mapping[c.column] = c.field;
    used.add(c.field);
  }
  return mapping;
}

/** The fields a mapping must cover before rows can be read at all. */
export function missingRequired(mapping: ColumnMapping): ImportField[] {
  const has = (f: ImportField) => mapping.includes(f);
  const missing: ImportField[] = [];
  if (!has("ownerName") && !(has("ownerFirstName") && has("ownerLastName")))
    missing.push("ownerName");
  if (!has("petName")) missing.push("petName");
  if (!has("species")) missing.push("species");
  return missing;
}

/** Column index per field, the shape the row reader wants. */
export function fieldIndex(
  mapping: ColumnMapping,
): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  mapping.forEach((field, column) => {
    if (field && out[field] === undefined) out[field] = column;
  });
  return out;
}

/**
 * A mapping that came over the wire, held to the shape this file defines.
 * Unknown names become "not imported"; a field claimed twice keeps its
 * first column, so the server never reads one field from two places.
 */
export function sanitizeMapping(raw: unknown, columns: number): ColumnMapping {
  const known = new Set<string>(IMPORT_FIELDS);
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  return Array.from({ length: columns }, (_, i) => {
    const value = list[i];
    if (typeof value !== "string" || !known.has(value) || seen.has(value)) return null;
    seen.add(value);
    return value as ImportField;
  });
}
