// Shared Zod building blocks for form schemas across the app.
// Every form field arrives as a string from FormData; helpers below parse,
// trim, and coerce them into the typed values the database expects.
//
// Messages are never plain sentences: `msg()` encodes a translation key (and
// its params) into the Zod message string, and the server-action wrapper
// resolves it in the request's locale before the state reaches the client —
// see `localizeState` in lib/action.ts. A `field` param is itself a
// translation key (e.g. "pet.owner") so labels stay localised too.

import { z, type ZodError } from "zod";
import { MAX_MONEY_CENTS, parseMoneyToCents } from "./money";

/** Marker prefix for an encoded, not-yet-translated message. */
export const MESSAGE_PREFIX = "@t:";

export function msg(
  key: string,
  params?: Record<string, string | number>,
): string {
  return params && Object.keys(params).length > 0
    ? `${MESSAGE_PREFIX}${key}:${JSON.stringify(params)}`
    : `${MESSAGE_PREFIX}${key}`;
}

// A control that is not rendered (a hidden `visitId` on a page that has no
// visit, a field behind a collapsed option) never reaches FormData at all, so
// `Object.fromEntries` leaves its key out entirely. Every helper below is
// built on `trim`, so treating a missing key as "" here keeps an optional
// field optional and lets a required one report the right message instead of
// a type error nobody sees.
const trim = z
  .preprocess((v) => (v == null ? "" : v), z.string())
  .transform((v) => v.trim());

const requiredMsg = (field?: string) =>
  field ? msg("error.form.required", { field }) : msg("error.form.requiredGeneric");

const minLengthMsg = (min: number, field?: string) =>
  field
    ? msg("error.form.minLength", { field, min })
    : msg("error.form.minLengthGeneric", { min });

const maxLengthMsg = (max: number, field?: string) =>
  field
    ? msg("error.form.maxLength", { field, max })
    : msg("error.form.maxLengthGeneric", { max });

/** `field` is a translation key for the field's label, e.g. "pet.name". */
export const requiredText = (min: number, max: number, field?: string) =>
  trim
    .refine(
      (v) => v.length >= min,
      min <= 1 ? requiredMsg(field) : minLengthMsg(min, field),
    )
    .refine((v) => v.length <= max, maxLengthMsg(max, field));

export const optionalText = (max: number) =>
  trim
    .refine((v) => v.length <= max, maxLengthMsg(max))
    .transform((v) => (v === "" ? null : v));

/** A required reference to another record, picked from a list. */
export const requiredId = (field: string, max = 40) =>
  trim
    .refine((v) => v.length > 0, msg("error.form.select", { field }))
    .refine((v) => v.length <= max, msg("error.form.invalidChoice"));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const requiredEmail = trim
  .refine((v) => v.length > 0, msg("error.form.required", { field: "auth.email" }))
  .refine((v) => EMAIL_RE.test(v), msg("error.form.email"))
  .refine((v) => v.length <= 120, msg("error.form.emailTooLong"));

export const optionalEmail = trim
  .refine((v) => v === "" || EMAIL_RE.test(v), msg("error.form.email"))
  .refine((v) => v.length <= 120, msg("error.form.emailTooLong"))
  .transform((v) => (v === "" ? null : v));

/** Password rules shared by sign-up and staff creation. */
export const password = (field = "auth.password") =>
  trim
    .refine((v) => v.length >= 8, msg("error.form.passwordMin", { min: 8 }))
    .refine((v) => v.length <= 100, maxLengthMsg(100, field));

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  trim
    .refine(
      (v) => v === "" || (values as readonly string[]).includes(v),
      msg("error.form.invalidChoice"),
    )
    .transform((v) => (v === "" ? null : (v as T[number])));

export const requiredEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  trim
    .refine(
      (v) => (values as readonly string[]).includes(v),
      msg("error.form.invalidChoice"),
    )
    .transform((v) => v as T[number]);

export const optionalDate = trim
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), msg("error.form.date"))
  .transform((v) => (v === "" ? null : new Date(v)));

export const requiredDateTime = trim
  .refine((v) => v.length > 0, msg("error.form.dateTimeRequired"))
  .refine((v) => !Number.isNaN(Date.parse(v)), msg("error.form.date"))
  .transform((v) => new Date(v));

export const optionalDateTime = trim
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), msg("error.form.date"))
  .transform((v) => (v === "" ? null : new Date(v)));

export const optionalFloat = (opts: { min?: number; max?: number } = {}) =>
  trim
    .refine((v) => {
      if (v === "") return true;
      const n = Number(v);
      if (!Number.isFinite(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    }, numberMsg(opts))
    .transform((v) => (v === "" ? null : Number(v)));

export const optionalInt = (opts: { min?: number; max?: number } = {}) =>
  trim
    .refine((v) => {
      if (v === "") return true;
      const n = Number.parseInt(v, 10);
      if (!Number.isInteger(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    }, integerMsg(opts))
    .transform((v) => (v === "" ? null : Number.parseInt(v, 10)));

export const requiredInt = (opts: { min?: number; max?: number } = {}) =>
  trim
    .refine((v) => {
      if (v === "") return false;
      const n = Number.parseInt(v, 10);
      if (!Number.isInteger(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    }, integerMsg(opts))
    .transform((v) => Number.parseInt(v, 10));

// A range is far more useful than "invalid number", so say it when we have one.
function numberMsg(opts: { min?: number; max?: number }): string {
  if (opts.min != null && opts.max != null)
    return msg("error.form.numberRange", { min: opts.min, max: opts.max });
  return msg("error.form.number");
}

function integerMsg(opts: { min?: number; max?: number }): string {
  if (opts.min != null && opts.max != null)
    return msg("error.form.integerRange", { min: opts.min, max: opts.max });
  return msg("error.form.integer");
}

// Money never converts itself: `parseMoneyToCents` is the only place text
// becomes cents, and both bounds below are expressed in cents too, so a
// caller cannot mix the two units by accident.
interface MoneyOpts {
  /** Smallest accepted amount in cents. Defaults to 0. */
  minCents?: number;
  /** Largest accepted amount in cents. */
  maxCents?: number;
}

const centsInRange = (cents: number | null, opts: MoneyOpts): boolean =>
  cents != null &&
  cents >= (opts.minCents ?? 0) &&
  cents <= (opts.maxCents ?? MAX_MONEY_CENTS);

export const optionalMoneyCents = (opts: MoneyOpts = {}) =>
  trim
    .refine(
      (v) => v === "" || centsInRange(parseMoneyToCents(v), opts),
      msg("error.form.amount"),
    )
    .transform((v) => (v === "" ? null : parseMoneyToCents(v)!));

export const requiredMoneyCents = (opts: MoneyOpts = {}) =>
  trim
    .refine((v) => centsInRange(parseMoneyToCents(v), opts), msg("error.form.amount"))
    .transform((v) => parseMoneyToCents(v)!);

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

export function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] as string | undefined) ?? "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
