// The one place money crosses between text and storage.
//
// Money is stored as an integer number of cents. Every amount a user types
// goes through `parseMoneyToCents` and every amount put back into an input
// goes through `centsToInputValue`; nothing multiplies or divides by 100 on
// its own. A second conversion site is how "500" once became 5,00.
//
// Display formatting (with a currency symbol) stays in `formatMoney`.

/** Largest amount any money field accepts, in cents: 10.000.000,00. */
export const MAX_MONEY_CENTS = 1_000_000_000;

/**
 * Reads an amount a person typed and returns whole cents, or `null` when the
 * text is not an amount we are sure about. Never guesses: an input we cannot
 * read unambiguously is rejected so the user sees an error instead of a
 * silently wrong number.
 *
 * Both notations are accepted, because the app runs in two locales and a
 * clinic pastes what its own keyboard produces:
 *
 *   "1.234,56" → 123456   "1,234.56" → 123456   "1234,5" → 123450
 *
 * The ambiguous case is a single separator followed by exactly three digits
 * ("1.500"). It is read as a **thousands separator**, because that is what it
 * means in both locales in practice: Turkish writes 1,50 for one and a half
 * lira and English writes 1,500 for fifteen hundred. Reading it as a decimal
 * point would turn 1.500 TL into 1,50 TL.
 *
 * More than two decimals is rejected rather than rounded: sub-cent precision
 * in a clinic's invoice is a typo, and rounding it away is a silent edit.
 */
export function parseMoneyToCents(value: string): number | null {
  const cleaned = value.replace(/[\s   ]/g, "");
  if (cleaned === "" || !/^[0-9]*[0-9.,][0-9.,]*$/.test(cleaned)) return null;
  if (!/[0-9]/.test(cleaned)) return null;

  const lastSep = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  if (lastSep === -1) return toCents(cleaned, "");

  const decimalChar = cleaned[lastSep];
  const otherChar = decimalChar === "." ? "," : ".";
  const digitsAfter = cleaned.length - lastSep - 1;
  const isDecimalPoint =
    cleaned.includes(otherChar) ||
    (occurrences(cleaned, decimalChar) === 1 && digitsAfter !== 3);

  if (!isDecimalPoint) {
    // Every separator is a thousands separator, so there is no fraction.
    return toCents(cleaned, "", decimalChar);
  }
  if (digitsAfter < 1 || digitsAfter > 2) return null;
  const whole = cleaned.slice(0, lastSep);
  const fraction = cleaned.slice(lastSep + 1);
  if (whole.includes(decimalChar)) return null;
  return toCents(whole, fraction, otherChar);
}

/**
 * Turns stored cents into the text an input should show, in the user's own
 * notation, so what is read back is what `parseMoneyToCents` will read.
 */
export function centsToInputValue(locale: string, cents: number): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function occurrences(text: string, char: string): number {
  let n = 0;
  for (const c of text) if (c === char) n++;
  return n;
}

/**
 * `whole` may still carry thousands separators; they are dropped only after
 * their grouping is verified, so "1.23.456" is rejected instead of read as
 * 123456.
 */
function toCents(whole: string, fraction: string, groupChar?: string): number | null {
  let digits = whole;
  if (groupChar) {
    const parts = whole.split(groupChar);
    if (parts.length > 1) {
      const [first, ...rest] = parts;
      // A real grouped number never starts with a zero group, so "0,001" is
      // a typo rather than one thousand and is rejected instead of read.
      if (!/^[1-9][0-9]{0,2}$/.test(first)) return null;
      if (rest.some((p) => !/^[0-9]{3}$/.test(p))) return null;
    }
    digits = parts.join("");
  }
  if (digits !== "" && !/^[0-9]+$/.test(digits)) return null;
  if (fraction !== "" && !/^[0-9]{1,2}$/.test(fraction)) return null;

  const units = digits === "" ? 0 : Number.parseInt(digits, 10);
  const cents = units * 100 + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(cents) ? cents : null;
}
