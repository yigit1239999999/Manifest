// Reading one spreadsheet cell into one database value.
//
// Every function here answers in three ways, not two: a value, nothing,
// or "there was something and it could not be read". The third is the
// whole point. A cell that said "32.13.2020" and arrives as an empty birth
// date looks exactly like a cell that was empty, and the clinic never
// learns it lost something (TEAM.md #2). So unreadable input is reported
// with what it was, and the caller decides whether that costs the row or
// only the field.

import { fold } from "@/lib/search";
import { DEFAULT_CALLING_CODE, normalizePhone } from "@/lib/phone";

// --- phone ---------------------------------------------------------------

/**
 * The comparable key for a phone number: international digits, so
 * "0532 123 45 67", "+90 532 123 4567" and "5321234567" are one number.
 * Built on `normalizePhone`, the same reading the SMS sender dials, so
 * "the same number" means the same thing here and there.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const key = normalizePhone(raw, DEFAULT_CALLING_CODE);
  // A Turkish number has exactly ten digits after the 90. `normalizePhone`
  // is country-agnostic and accepts eight, which is right for a form and
  // wrong for matching: "123456" would become a number two rows share.
  if (key?.startsWith(DEFAULT_CALLING_CODE) && key.length !== 12) return null;
  return key;
}

/** "905321234567" → "0532 123 45 67"; anything else as written. */
export function displayPhone(raw: string): string {
  const key = phoneKey(raw);
  if (key && key.startsWith("90") && key.length === 12) {
    const n = key.slice(2);
    return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8)}`;
  }
  return raw.trim();
}

export type PhoneCell =
  | { kind: "empty" }
  | { kind: "ok"; phone: string; key: string; secondary: string | null }
  | { kind: "invalid"; raw: string };

/**
 * A phone cell, which in a hand-kept sheet is often two numbers:
 * "0532 111 11 11 / 0216 222 22 22". The first becomes the phone, the
 * second the secondary phone, rather than both being glued into one
 * undiallable string of 22 digits.
 */
export function readPhone(raw: string): PhoneCell {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const parts = text
    .split(/\s*[\/,;|]\s*|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid = parts.filter((p) => phoneKey(p));
  if (valid.length === 0) return { kind: "invalid", raw: text };
  return {
    kind: "ok",
    phone: displayPhone(valid[0]),
    key: phoneKey(valid[0])!,
    secondary: valid[1] ? displayPhone(valid[1]) : null,
  };
}

// --- email ---------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailCell =
  | { kind: "empty" }
  | { kind: "ok"; email: string; key: string }
  | { kind: "invalid"; raw: string };

export function readEmail(raw: string): EmailCell {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (!EMAIL_RE.test(text) || text.length > 120) return { kind: "invalid", raw: text };
  return { kind: "ok", email: text, key: text.toLocaleLowerCase("en") };
}

// --- names ---------------------------------------------------------------

/** Collapses runs of whitespace; spreadsheets are full of double spaces. */
export function clean(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** A folded full name, for "is this the same person" comparisons. */
export function nameKey(first: string, last: string): string {
  return fold(clean(`${first} ${last}`));
}

/**
 * "Mehmet Ali Kaya" → first "Mehmet Ali", last "Kaya". Turkish given
 * names are often two words and surnames almost never are, so the last
 * word is the surname. A single word cannot be split honestly and is
 * returned as such for the caller to refuse.
 */
export function splitFullName(
  raw: string,
): { first: string; last: string } | { single: string } | null {
  const text = clean(raw);
  if (!text) return null;
  const words = text.split(" ");
  if (words.length === 1) return { single: text };
  return { first: words.slice(0, -1).join(" "), last: words[words.length - 1] };
}

// --- dates ---------------------------------------------------------------

/** How "03/04/2020" is to be read, once somebody has said. */
export type DateOrder = "DMY" | "MDY";

export type DateCell =
  | { kind: "empty" }
  | { kind: "ok"; date: string }
  | { kind: "invalid"; raw: string; reason: "unreadable" | "yearOnly" }
  /** Both readings are real dates and nothing in the cell picks one. */
  | { kind: "ambiguous"; raw: string; dmy: string; mdy: string };

const pad = (n: number) => String(n).padStart(2, "0");

function isoDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Catches 30 February: Date rolls it into March instead of refusing.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * A two-digit year, for an animal: "15" is 2015, "98" is 1998. The cut-off
 * is this year, so a year ahead of us falls back a century rather than
 * into the future. For a person's records this would be a guess; for a
 * pet, whose lifespan fits comfortably inside the window, it is not.
 */
function fullYear(y: number, today: Date): number {
  if (y >= 100) return y;
  const current = today.getUTCFullYear() % 100;
  return y <= current ? 2000 + y : 1900 + y;
}

const MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4,
  april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};

/** Excel's day zero in the 1900 system, which includes its fictional 29 Feb 1900. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * One date cell.
 *
 *   "2020-04-03", "2020.04.03"      → ISO, unambiguous
 *   "03.04.2020"                    → 3 April: dots are the Turkish way of
 *                                     writing a date, and nobody writes
 *                                     month-first with dots
 *   "03/04/2020", "03-04-2020"      → ambiguous unless a part is over 12,
 *                                     or `order` says how to read it
 *   "44562"                         → an Excel serial day number
 *   "3 Nisan 2020", "3 April 2020"  → month by name
 *
 * The reader of a spreadsheet decides `order` once for the file; nothing
 * here guesses it, because a wrong guess moves every birthday in the
 * sheet by up to eleven months and looks perfectly plausible doing it.
 */
export function readDate(
  raw: string,
  order: DateOrder | null = null,
  today: Date = new Date(),
): DateCell {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const bad = { kind: "invalid", raw: text, reason: "unreadable" } as const;

  // ISO, possibly with a time after it (date cells arrive like this).
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (m) {
    const iso = isoDay(+m[1], +m[2], +m[3]);
    return iso ? { kind: "ok", date: iso } : bad;
  }

  // Serial day numbers. Below 10000 (1927) a number in a date column is
  // much more likely to be something else, and a bare year most of all.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 1900 && n <= 2100)
      return { kind: "invalid", raw: text, reason: "yearOnly" };
    if (n >= 10000 && n < 80000) {
      const d = new Date(EXCEL_EPOCH + Math.floor(n) * 86_400_000);
      return {
        kind: "ok",
        date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      };
    }
    return bad;
  }

  // Day first with dots: firm.
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(text);
  if (m) {
    const iso = isoDay(fullYear(+m[3], today), +m[2], +m[1]);
    return iso ? { kind: "ok", date: iso } : bad;
  }

  // Slashes or dashes: the order is the question.
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = fullYear(+m[3], today);
    const dmy = isoDay(y, b, a);
    const mdy = isoDay(y, a, b);
    if (dmy && mdy && dmy !== mdy) {
      if (order === "DMY") return { kind: "ok", date: dmy };
      if (order === "MDY") return { kind: "ok", date: mdy };
      return { kind: "ambiguous", raw: text, dmy, mdy };
    }
    const only = dmy ?? mdy;
    return only ? { kind: "ok", date: only } : bad;
  }

  // "3 Nisan 2020", "3 Nis 2020", "April 3, 2020".
  const words = fold(text).replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 3) {
    const [x, y, z] = words;
    const month = (w: string) => MONTHS[w] ?? MONTHS[w.slice(0, 3)];
    if (/^\d{1,2}$/.test(x) && month(y) && /^\d{4}$/.test(z)) {
      const iso = isoDay(+z, month(y), +x);
      return iso ? { kind: "ok", date: iso } : bad;
    }
    if (month(x) && /^\d{1,2}$/.test(y) && /^\d{4}$/.test(z)) {
      const iso = isoDay(+z, month(x), +y);
      return iso ? { kind: "ok", date: iso } : bad;
    }
  }
  return bad;
}

/**
 * What the file itself says about its slash dates: how many could only be
 * day-first, and how many could only be month-first. Shown beside the
 * question so the person answering it has the evidence, and never used to
 * answer it for them.
 */
export function dateOrderEvidence(values: readonly string[]): { dmy: number; mdy: number } {
  let dmy = 0;
  let mdy = 0;
  for (const raw of values) {
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(raw.trim());
    if (!m) continue;
    if (+m[1] > 12 && +m[2] <= 12) dmy += 1;
    else if (+m[2] > 12 && +m[1] <= 12) mdy += 1;
  }
  return { dmy, mdy };
}

// --- sex, neutered, weight, microchip -------------------------------------

export type SexValue = "MALE" | "FEMALE" | "UNKNOWN";

const MALE = new Set(["erkek", "e", "er", "male", "m", "erkek kisir", "kisir erkek", "erkek kastre", "kastre erkek"]);
const FEMALE = new Set(["disi", "d", "female", "f", "disi kisir", "kisir disi", "disi kastre", "kastre disi"]);
const UNKNOWN_SEX = new Set(["bilinmiyor", "belirsiz", "unknown", "u", "?", "-"]);

/**
 * "Erkek (kısır)" says two things and both are kept: the sex, and that
 * the animal is neutered. Old clinic software writes it that way more
 * often than it has a separate column for it.
 */
export function readSex(
  raw: string,
): { kind: "empty" } | { kind: "ok"; sex: SexValue; neutered: boolean } | { kind: "invalid"; raw: string } {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const key = fold(text).replace(/[^a-z?-]+/g, " ").trim();
  const neutered = /\b(kisir|kastre|kisirlastirilmis)\b/.test(key);
  if (MALE.has(key)) return { kind: "ok", sex: "MALE", neutered };
  if (FEMALE.has(key)) return { kind: "ok", sex: "FEMALE", neutered };
  if (UNKNOWN_SEX.has(key)) return { kind: "ok", sex: "UNKNOWN", neutered: false };
  return { kind: "invalid", raw: text };
}

const YES = new Set(["evet", "e", "var", "yes", "y", "true", "1", "x", "✓", "✔", "kisir", "kisirlastirilmis", "kisirlastirildi", "kastre", "neutered", "spayed"]);
const NO = new Set(["hayir", "h", "yok", "no", "n", "false", "0", "-", "degil"]);

export function readYesNo(
  raw: string,
): { kind: "empty" } | { kind: "ok"; value: boolean } | { kind: "invalid"; raw: string } {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const key = fold(text);
  if (YES.has(key)) return { kind: "ok", value: true };
  if (NO.has(key)) return { kind: "ok", value: false };
  return { kind: "invalid", raw: text };
}

/** "4,5", "4.5 kg", "1.250,5" → kilograms. Grams are not guessed at. */
export function readWeight(
  raw: string,
): { kind: "empty" } | { kind: "ok"; kg: number } | { kind: "invalid"; raw: string } {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  let s = fold(text).replace(/\s*(kg|kilo|kilogram)\s*$/, "").replace(/\s+/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return { kind: "invalid", raw: text };
  const kg = Number(s);
  if (!(kg > 0) || kg > 1000) return { kind: "invalid", raw: text };
  return { kind: "ok", kg: Math.round(kg * 100) / 100 };
}

/**
 * A microchip number as written, without its spaces. A cell reading
 * "9,00123E+14" is refused rather than read: Excel has already rounded
 * the last digits away, and the number that would be stored belongs to
 * somebody else's animal, or to nobody's.
 */
export function readMicrochip(
  raw: string,
): { kind: "empty" } | { kind: "ok"; chip: string } | { kind: "invalid"; raw: string; reason: "scientific" | "unreadable" } {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (/^\d+([.,]\d+)?e\+?\d+$/i.test(text)) return { kind: "invalid", raw: text, reason: "scientific" };
  const chip = text.replace(/[\s-]+/g, "");
  if (!/^[A-Za-z0-9]{6,30}$/.test(chip)) return { kind: "invalid", raw: text, reason: "unreadable" };
  return { kind: "ok", chip: chip.toUpperCase() };
}
