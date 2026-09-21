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
 * What each separator means in a locale.
 *
 * Reading a number without knowing the locale cannot be done safely: a
 * Turkish "12,345" is twelve lira and 34,5 kuruş (sub-cent, a typo), while an
 * English "12,345" is twelve thousand. Both are one separator followed by
 * three digits, so any locale-blind rule gets one of them wrong by a factor
 * of a thousand — and does it silently.
 */
function separatorsOf(locale: string): { decimal: string; group: string } {
  return locale === "tr"
    ? { decimal: ",", group: "." }
    : { decimal: ".", group: "," };
}

/**
 * Reads an amount a person typed in their own locale and returns whole
 * cents, or `null` when the text is not an amount we are sure about. It
 * never guesses: anything it cannot read unambiguously is rejected so the
 * user sees an error instead of a silently wrong number.
 *
 *   tr: "1.234,56" → 123456   "12.345" → 1234500   "12,345" → null
 *   en: "1,234.56" → 123456   "12,345" → 1234500   "12.345" → null
 *
 * The rejected cases are sub-cent precision ("12,345" in Turkish is 12,345
 * lira). Rounding it away would be a silent edit of someone's money, and
 * reading it as a thousands separator — which is what a locale-blind version
 * of this function did — multiplied it by a thousand.
 */
export function parseMoneyToCents(value: string, locale: string): number | null {
  const { decimal, group } = separatorsOf(locale);
  const cleaned = value.replace(/[\s   ]/g, "");
  if (cleaned === "" || !/^[0-9.,]+$/.test(cleaned)) return null;
  if (!/[0-9]/.test(cleaned)) return null;

  const lastDecimal = cleaned.lastIndexOf(decimal);
  if (lastDecimal === -1) return toCents(cleaned, "", group);

  // Only one decimal separator, and nothing groups digits after it.
  if (cleaned.indexOf(decimal) !== lastDecimal) return null;
  const fraction = cleaned.slice(lastDecimal + 1);
  if (fraction.includes(group)) return null;
  if (fraction.length < 1 || fraction.length > 2) return null;

  return toCents(cleaned.slice(0, lastDecimal), fraction, group);
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

/**
 * `whole` may still carry thousands separators; they are dropped only after
 * their grouping is verified, so "1.23.456" is rejected instead of read as
 * 123456, and "0.001" is a typo rather than one thousand.
 */
function toCents(whole: string, fraction: string, groupChar: string): number | null {
  const parts = whole.split(groupChar);
  if (parts.length > 1) {
    const [first, ...rest] = parts;
    if (!/^[1-9][0-9]{0,2}$/.test(first)) return null;
    if (rest.some((p) => !/^[0-9]{3}$/.test(p))) return null;
  }
  const digits = parts.join("");
  if (digits !== "" && !/^[0-9]+$/.test(digits)) return null;

  const units = digits === "" ? 0 : Number.parseInt(digits, 10);
  const cents = units * 100 + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(cents) ? cents : null;
}
