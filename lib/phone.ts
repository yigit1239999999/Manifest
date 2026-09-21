// The one place a phone number is read.
//
// A number reaches us as a person typed it ("0532 123 45 67", "+971 50 123
// 4567", "sabit hat yok") and leaves as digits a gateway can dial. Both
// halves live here: `isPossiblePhoneText` is what a form accepts,
// `normalizePhone` is what the sender dials. Keeping them apart is how
// "sabit hat yok" got stored as a phone number and how a number starting
// with 0 was dialled as if it were already international.

/**
 * Calling code used when a clinic has not said which country it is in.
 *
 * Today no clinic can: there is no write path for `Clinic.country` (backlog
 * 29), so every clinic reads as null and every local number would otherwise
 * be undiallable. The fallback is Turkey because that is the market the app
 * is in; it disappears the moment the country field exists.
 */
export const DEFAULT_CALLING_CODE = "90";

/** E.164 allows at most 15 digits; 8 is the shortest number worth dialling. */
const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

/** Characters a person legitimately types in a phone number. */
const PHONE_TEXT = /^[+()\-.\/\s\d]+$/;

/**
 * Whether text can be a phone number at all. Country-agnostic on purpose: a
 * form does not know which country the clinic is in, and rejecting a valid
 * foreign number is worse than accepting a badly spaced local one. It only
 * refuses what is certainly not a number — words, or too few digits.
 */
export function isPossiblePhoneText(raw: string): boolean {
  if (!PHONE_TEXT.test(raw)) return false;
  // A "+" only means anything at the front.
  if (raw.indexOf("+") > 0) return false;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS;
}

/**
 * Digits-only international number for a gateway, or null when the text
 * cannot be dialled.
 *
 *   "0532 123 45 67"   (TR clinic) → "905321234567"
 *   "050 123 4567"     (AE clinic) → "971501234567"
 *   "+90 (532) 123 45 67"          → "905321234567"
 *
 * How the country code is decided, in order:
 *   1. "+" or "00" at the front: the number is already international and is
 *      taken as written.
 *   2. A leading 0 is a national trunk prefix: it is dropped and the clinic's
 *      calling code takes its place. Dialling it unchanged is how a UAE
 *      "050…" number was sent as if it were a country code.
 *   3. A number that already begins with the clinic's own calling code and is
 *      long enough is treated as international, so "905321234567" is not
 *      turned into "90905321234567".
 *   4. Anything else is a national number and gets the clinic's code.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCallingCode: string = DEFAULT_CALLING_CODE,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!PHONE_TEXT.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;

  const code = defaultCallingCode.replace(/\D/g, "") || DEFAULT_CALLING_CODE;
  const international =
    trimmed.startsWith("+") || digits.startsWith("00")
      ? digits.replace(/^00/, "")
      : digits.startsWith("0")
        ? code + digits.slice(1)
        : digits.startsWith(code) && digits.length > code.length + 6
          ? digits
          : code + digits;

  if (international.length < MIN_E164_DIGITS) return null;
  if (international.length > MAX_E164_DIGITS) return null;
  return international;
}
