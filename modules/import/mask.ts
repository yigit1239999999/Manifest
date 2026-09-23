/**
 * What leaves this machine, and what never does.
 *
 * The product owner decided this on 23 September 2026, choosing between four
 * options that each showed exactly what would be sent:
 *
 *   masked sample values, shape preserved
 *     Ayşe Çelik      -> Xxxx Xxxxx
 *     0532 111 22 33  -> 0XXX XXX XX XX
 *     14.03.2025      -> XX.XX.XXXX
 *
 * Not one of the vet's rows goes to a model. The argument that settled it:
 * a masked value is enough to recognise a COLUMN and not enough to recognise
 * a PERSON -- for the question "is this a name column", `Ayşe Çelik` and
 * `Xxxx Xxxxx` are the same evidence, and nobody could show what the real
 * value added on top of the masked one.
 *
 * WHAT THIS IS NOT FOR: our own inference. `infer.ts` runs locally on the real
 * values, and it must -- masking erases exactly the signal it needs. "14" in
 * 14.03.2025 is what proves the column is day-first, and `XX.XX.XXXX` proves
 * nothing at all. So the order is: read the real file, decide locally what can
 * be decided, and send masked samples only for the columns that are left.
 * Masking is the shape of the OUTBOUND payload, never of our own reading.
 */
import { looksLikePhone } from "./infer";

/**
 * The one judgement call in here, written down because it is a judgement --
 * and narrowed after it leaked.
 *
 * The chosen example keeps the leading zero: `0532 111 22 33` -> `0XXX XXX XX
 * XX`, not `XXXX XXX XX XX`. Read literally that is what was approved, and the
 * reading it rests on is that a leading `0` (or `+90`) is FORMAT, not
 * identity: it says "a Turkish number written with its trunk prefix", which is
 * the very thing the model is being asked about, and it narrows a number down
 * to roughly every phone in the country.
 *
 * FIRST VERSION KEPT ANY LEADING ZERO AND THAT WAS A LEAK. `02.04.2025` came
 * out `0X.XX.XXXX` -- the second of the month, sent out, in a payload whose
 * entire promise is that real values do not leave. The exemption was written
 * as "a leading 0" when the thing it was arguing for was "a phone's trunk
 * prefix", and every value starting with a zero inherited a permission that
 * was never about it.
 *
 * So the exemption now asks whether the value IS a phone, using the same
 * reader the rest of the import uses. The lesson, more than the line: an
 * exemption stated by its SHAPE ("starts with 0") quietly covers everything
 * that shares the shape; state it by what it is FOR, and it covers that.
 *
 * (`(0532) 111 22 33` masks its zero too, since the prefix is not leading.
 * That is more masking than the rule requires, and more is the safe side.)
 */
const KEEPS_FORMAT_PREFIX = /^(\+90|0)/;

/**
 * Mask one value, keeping its shape and losing its content.
 *
 * Kept: every separator (space, dot, slash, dash, parenthesis), the length of
 * each run, where the word boundaries are, and whether a run was letters or
 * digits. Lost: which letters and which digits.
 *
 * Case is carried in a deliberately coarse way -- `X` for a run's first letter
 * and `x` after it -- because the point is to show "a capitalised word here",
 * not to reproduce anyone's typing. `AYŞE ÇELİK` and `Ayşe Çelik` both mask to
 * `Xxxx Xxxxx`, and that is correct: the difference between them is the vet's
 * shift key, not the column's meaning.
 */
export function mask(raw: string): string {
  const value = raw.trim();
  if (value === "") return "";

  const prefix = looksLikePhone(value) ? (KEEPS_FORMAT_PREFIX.exec(value)?.[0] ?? "") : "";
  const body = value.slice(prefix.length);

  let out = prefix;
  let atRunStart = true;
  for (const char of body) {
    if (/\d/.test(char)) {
      out += "X";
      atRunStart = false;
    } else if (isLetter(char)) {
      out += atRunStart ? "X" : "x";
      atRunStart = false;
    } else {
      // A separator, kept as itself -- it is the shape we are trying to show.
      out += char;
      atRunStart = true;
    }
  }
  return out;
}

/**
 * A letter, including the six Turkish ones.
 *
 * `/[a-z]/i` would send `ş`, `ğ`, `ı`, `İ`, `ö`, `ü`, `ç` through the separator
 * branch, so `Ayşe` would mask to `Xxşx` -- which leaks a letter AND breaks
 * the run, making the next character look like the start of a new word. On a
 * Turkish clinic's file that is most names.
 */
function isLetter(char: string): boolean {
  return /\p{L}/u.test(char);
}

/**
 * The samples for one column: distinct, masked, and few.
 *
 * `limit` is 3 by default and is not a performance number -- it is the number
 * the vet will be shown next to their own header on the mapping screen, and
 * the same three that describe the column to a model. Distinct, because three
 * identical values say a third as much as three different ones.
 *
 * Blanks are dropped rather than masked: `""` masks to `""`, which would spend
 * a sample slot saying nothing. How often a column is blank is reported
 * separately by `classifyColumn`, where it is a count rather than a sample.
 */
export function maskedSamples(values: string[], limit = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const masked = mask(value);
    if (masked === "" || seen.has(masked)) continue;
    seen.add(masked);
    out.push(masked);
    if (out.length >= limit) break;
  }
  return out;
}
