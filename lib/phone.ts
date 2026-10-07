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
 * A number made only of zeros is a placeholder, not a number.
 *
 * The length floor was standing in for "long enough to mean
 * something", and `0000000000` clears it: ten digits, accepted by the
 * form, normalised to an eight-digit string, and handed to a gateway
 * as a real send. Appearance is not what decides here -- digit count
 * is -- so a value that looks obviously fake to a person passes
 * anyway. Somebody who cannot leave a field empty types zeros, which
 * makes this a habit rather than an accident.
 *
 * Checked on what was typed, before a calling code is prepended:
 * afterwards "90" supplies the non-zero digit and the test would pass
 * everything.
 *
 * Deliberately only zeros. "Must start with 5", "these prefixes are
 * valid" and the rest belong to a country the clinic cannot yet
 * declare (`Clinic.country` has no write path), and writing them now
 * would reject a Dubai number to catch a placeholder.
 */
const hasRealDigit = (digits: string) => /[1-9]/.test(digits);

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
  if (!hasRealDigit(digits)) return false;
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
  if (!hasRealDigit(digits)) return null;

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

/**
 * A `tel:` target a phone actually dials, or null when the text cannot be
 * dialled at all.
 *
 *   "0532 111 11 11" (TR clinic) → "tel:+905321111111"
 *   "sabit hat yok"              → null
 *
 * The screens were writing `tel:${client.phone}` with the number exactly as
 * someone typed it. Dialling that is a gamble: spaces and parentheses are
 * tolerated by most handsets, a leading 0 is not international, and on a
 * desktop the link simply fails. The number that reaches a gateway has gone
 * through `normalizePhone` since backlog 6; the number behind a link had
 * not, so the two disagreed about the same field.
 *
 * Returns null rather than a broken link, so a call site can render plain
 * text instead of something that looks tappable and is not.
 */
export function telHref(
  raw: string | null | undefined,
  defaultCallingCode: string = DEFAULT_CALLING_CODE,
): string | null {
  const digits = normalizePhone(raw, defaultCallingCode);
  return digits ? `tel:+${digits}` : null;
}

/**
 * A number with only its last four digits left, for output a person
 * reads but no one should be able to dial from.
 *
 *   "905321234567" → "•••• 4567"
 *
 * Written for the sweep's dry run, which prints what would go out.
 * The rehearsal exists so nobody has to send a real message to find
 * out what a real message would say -- and it would be a poor
 * rehearsal that spread the numbers around a terminal to do it. One
 * of them reached mine today, from a read-only query that selected a
 * column it did not need.
 *
 * Four digits is enough to tell two recipients apart and not enough
 * to call either.
 */
export function maskPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

/**
 * A number the way it is printed on every screen: Turkish numbers in the
 * one shape a Turkish reader expects, "0532 411 22 33", whatever was typed
 * ("+90 (532) 4112233", "5324112233", "0532-411-22-33"). Anything that is
 * not recognisably a Turkish number -- a foreign one, a note somebody typed
 * -- comes back as typed, trimmed: reshaping a Dubai number into Turkish
 * groups would be inventing a format, and dropping it would hide it.
 */
export function formatPhone(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const national = turkishNational(text);
  if (!national) return text;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8, 10)}`;
}

/**
 * The ten national digits of a Turkish number ("5324112233"), or null when
 * the text is not one. Area codes start with 2-5 (landlines 2-4, mobiles 5);
 * anything else is left alone.
 */
export function turkishNational(raw: string): string | null {
  if (!PHONE_TEXT.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  // Written internationally: only Turkey's own code makes it a Turkish
  // number, whatever its length.
  const international = raw.trim().startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international) {
    if (!(digits.length === 12 && digits.startsWith("90"))) return null;
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 || !/^[2-5]/.test(digits)) return null;
  return digits;
}
