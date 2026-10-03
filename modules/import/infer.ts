/**
 * What a column is, read from what is IN it -- not from what it is called.
 *
 * This file exists because of one sentence from the vet, and the sentence
 * is the requirement:
 *
 *   "Eğer içeri alma benim başlık satırımı bilmeye muhtaçsa zaten kırılgan
 *    demektir. Başlığımı bilmeden de çalışması lazım, çünkü benim dosyamın
 *    kendi içinde bile iki ayrı yazım var."
 *
 * Their file was written by three people over years. Header spellings are a
 * writing habit, not a schema, so matching on header text ("Tel", "TELEFON",
 * "Cep no") is a guess dressed as a lookup -- and it fails silently on the
 * next clinic's file. Header text is allowed to RAISE confidence later; it is
 * never allowed to be the thing that decides.
 *
 * TWO CLASSES, AND THE SPLIT IS THE POINT
 *
 * Some columns are decidable from their values and some are not, and pretending
 * otherwise is how an importer writes a pet's name into the owner field:
 *
 *   decidable    -- phone, date, number, email, and "this column is empty".
 *                   These have shape. A value either looks like a phone or it
 *                   does not, and the share that does is a measurement.
 *   undecidable  -- names, breeds, free text. The vet's file has the pet and
 *                   the owner ON THE SAME ROW, so there are at least two
 *                   name-shaped columns, and no amount of looking at values
 *                   separates "Boncuk" from "Ayşe Çelik" reliably. Worse under
 *                   #19's masking, where both become "Xxxx". Token count is a
 *                   hint, not a rule.
 *
 * So `decidable` is not a confidence score with a threshold -- it is a
 * statement about whether a human has to be asked. An undecidable column with
 * 100% agreement is still undecidable.
 *
 * WHAT THIS FILE DOES NOT DO: it does not map a column to a PetTrack field, it
 * does not read files, and it does not call a model. It reports evidence. The
 * mapping screen decides what to propose and the vet decides what is true
 * (#20: the product suggests, it does not rule).
 */

/** The shape a column's values agree on, if they agree on one. */
export type ColumnKind =
  | "phone"
  | "date"
  | "number"
  | "email"
  | "text"
  | "empty";

/**
 * Markers the vet could not tell us about, so we detect them instead.
 *
 * Asked whether an unknown birth date is left blank or written as something,
 * the answer was "bilmiyorum" -- and that was the honest answer, not a gap to
 * paper over. A file can say "nothing here" in at least these ways, and a "-"
 * imported as a phone number is a wrong fact, which is worse than a missing
 * one: a missing number gets looked up, a wrong one gets dialled.
 */
const BLANK_MARKERS = ["-", "--", "—", "–", "/", ".", "?", "yok", "bilinmiyor", "bilinmiyo", "belirsiz", "n/a", "na", "null", "boş"];

export function isBlank(raw: string): boolean {
  const v = raw.trim();
  if (v === "") return true;
  // Turkish lowercasing, done deliberately: JS `toLowerCase` turns "İ" into
  // "i" + U+0307, so "BİLİNMİYOR" would not equal "bilinmiyor" without this.
  const folded = v.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  return BLANK_MARKERS.includes(folded);
}

/**
 * A Turkish mobile or landline, however the person who typed it felt that day.
 *
 * Accepted, all seen in the wild and all the same number:
 *   0532 111 22 33 · 05321112233 · 532 111 22 33 · +90 532 111 22 33
 *   (532) 111 22 33 · 0532-111-22-33
 *
 * NOT accepted, on purpose: a bare 10-digit run with no leading 0/+90 and no
 * separators is left to `number`. It could be a phone; it could equally be a
 * chip number or a price. A column of those is exactly the case the vet has to
 * be asked about, so it must not arrive pre-decided.
 */
const PHONE_DIGITS = /^(?:\+?90)?0?(5\d{9}|[2-4]\d{9})$/;

export function looksLikePhone(raw: string): boolean {
  const v = raw.trim();
  if (!/[\s().+-]/.test(v) && !/^0/.test(v) && !/^\+/.test(v)) return false;
  const digits = v.replace(/[\s().+-]/g, "");
  if (!/^\d+$/.test(digits.replace(/^\+/, ""))) return false;
  return PHONE_DIGITS.test(digits);
}

/** How the file writes phone numbers, kept so we can show it back to them. */
export type PhoneShape = "spaced" | "joined" | "dashed" | "mixed";

function phoneShape(values: string[]): PhoneShape {
  const shapes = new Set<PhoneShape>();
  for (const v of values) {
    if (v.includes("-")) shapes.add("dashed");
    else if (/\s/.test(v.trim())) shapes.add("spaced");
    else shapes.add("joined");
  }
  if (shapes.size === 1) return [...shapes][0];
  return "mixed";
}

/**
 * A date, and -- the part that matters -- WHICH date.
 *
 * `03.04.2025` is the 3rd of April to the person who typed it and the 4th of
 * March to an importer that assumed month-first. Both parse. Only one is true,
 * and the wrong one lands in a vaccination record.
 *
 * So this deliberately returns an AMBIGUITY, not a date. The vet's own
 * expectation was "tarih uydurmaması" -- a product that silently picks an
 * order has not avoided guessing, it has hidden the guess. A column is only
 * unambiguous when some value in it has a first part over 12 (dayFirst), or a
 * second part over 12 (monthFirst), or a four-digit year in front (iso).
 */
export type DateOrder = "dayFirst" | "monthFirst" | "iso" | "ambiguous";

const DATE_PARTS = /^(\d{1,4})[.\/-](\d{1,2})[.\/-](\d{2,4})$/;

export function looksLikeDate(raw: string): boolean {
  const m = DATE_PARTS.exec(raw.trim());
  if (!m) return false;
  const [, a, b, c] = m;
  const first = Number(a);
  const second = Number(b);
  if (a.length === 4) return first >= 1900 && first <= 2999 && second >= 1 && second <= 12 && Number(c) >= 1 && Number(c) <= 31;
  return first >= 1 && first <= 31 && second >= 1 && second <= 31 && (c.length === 2 || (Number(c) >= 1900 && Number(c) <= 2999));
}

function dateOrder(values: string[]): DateOrder {
  let sawIso = false;
  let sawDayFirst = false;
  let sawMonthFirst = false;
  for (const raw of values) {
    const m = DATE_PARTS.exec(raw.trim());
    if (!m) continue;
    const [, a, b] = m;
    if (a.length === 4) { sawIso = true; continue; }
    if (Number(a) > 12) sawDayFirst = true;
    if (Number(b) > 12) sawMonthFirst = true;
  }
  // Both cannot be true of one consistent file. If they are, the column holds
  // two writing habits -- which is the vet's own file, and the honest report
  // is still "ambiguous": neither order explains every row.
  if (sawDayFirst && sawMonthFirst) return "ambiguous";
  if (sawDayFirst) return "dayFirst";
  if (sawMonthFirst) return "monthFirst";
  if (sawIso) return "iso";
  return "ambiguous";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/**
 * A plain number, exported because one predicate should have one home.
 *
 * `read-workbook.ts` needed "does this value have a shape a name would not
 * have" for its header check, and grew its own regexes for it -- a second,
 * broader definition of phone-shaped sitting one file away from this one.
 * Neither was wrong on the day it was written, and that is exactly how two
 * definitions of the same idea drift apart: nothing fails when they disagree,
 * they just start answering differently, and the one nobody is looking at
 * becomes the one that decides something.
 */
export function looksLikeNumber(raw: string): boolean {
  return NUMBER.test(raw.trim());
}

export type ColumnEvidence = {
  kind: ColumnKind;
  /** Share of NON-BLANK values that fit `kind`, 0..1. Blanks never count against a column. */
  agreement: number;
  /** True when the values themselves settle it. False means a human is asked. */
  decidable: boolean;
  /** How many values were blank, and which markers said so. */
  blankCount: number;
  blankMarkers: string[];
  /** Distinct non-blank values; a small number on many rows is a category. */
  distinctCount: number;
  /** Set for phones and dates: the writing habit found, reported not corrected. */
  phoneShape?: PhoneShape;
  dateOrder?: DateOrder;
  /** Up to three real values, for showing the vet their own data back. */
  samples: string[];
};

/**
 * The share at which a column counts as "these values agree".
 *
 * Not tuned -- chosen, and chosen loose on purpose. The vet's file has rows
 * typed by three people and dead animals left unmarked; a column of phones
 * with four junk cells is still a phone column, and demanding 100% would push
 * every real-world column into "ask the human", which is the same as having no
 * inference at all. A column BELOW this is not an error either: it is a column
 * we do not get to decide, which is a different and honest outcome.
 */
export const AGREEMENT = 0.8;

export function classifyColumn(rawValues: string[]): ColumnEvidence {
  const blanks: string[] = [];
  const values: string[] = [];
  for (const raw of rawValues) {
    if (isBlank(raw)) { if (raw.trim() !== "") blanks.push(raw.trim()); continue; }
    values.push(raw.trim());
  }

  const base = {
    blankCount: rawValues.length - values.length,
    blankMarkers: [...new Set(blanks)],
    distinctCount: new Set(values).size,
    samples: [...new Set(values)].slice(0, 3),
  };

  if (values.length === 0) {
    return { kind: "empty", agreement: 1, decidable: true, ...base };
  }

  const share = (test: (v: string) => boolean) =>
    values.filter(test).length / values.length;

  const phone = share(looksLikePhone);
  if (phone >= AGREEMENT) {
    return { kind: "phone", agreement: phone, decidable: true, phoneShape: phoneShape(values), ...base };
  }
  const email = share((v) => EMAIL.test(v));
  if (email >= AGREEMENT) {
    return { kind: "email", agreement: email, decidable: true, ...base };
  }
  const date = share(looksLikeDate);
  if (date >= AGREEMENT) {
    const order = dateOrder(values);
    // A date column whose ORDER is unknown is not decided. We know it holds
    // dates; we do not know which dates, and that is the half that matters.
    return { kind: "date", agreement: date, decidable: order !== "ambiguous", dateOrder: order, ...base };
  }
  const number = share((v) => NUMBER.test(v));
  if (number >= AGREEMENT) {
    return { kind: "number", agreement: number, decidable: true, ...base };
  }

  // Everything else is text, and text is never decided here. A column of
  // "Kedi/Tekir" and one of "Boncuk" are both text; telling them apart is the
  // mapping screen's job, with the vet looking at it.
  return { kind: "text", agreement: 1, decidable: false, ...base };
}
