// Shared Zod building blocks for form schemas across the app.
// Every form field arrives as a string from FormData; helpers below parse,
// trim, and coerce them into the typed values the database expects.

import { z, type ZodError } from "zod";

const trim = z.string().transform((v) => v.trim());

export const requiredText = (min: number, max: number, label: string) =>
  trim
    .refine((v) => v.length >= min, `${label} gerekli.`)
    .refine((v) => v.length <= max, `${label} en fazla ${max} karakter olabilir.`);

export const optionalText = (max: number) =>
  trim
    .refine((v) => v.length <= max, `En fazla ${max} karakter olabilir.`)
    .transform((v) => (v === "" ? null : v));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const requiredEmail = trim
  .refine((v) => v.length > 0, "Email gerekli.")
  .refine((v) => EMAIL_RE.test(v), "Geçerli bir email girin.")
  .refine((v) => v.length <= 120, "Email çok uzun.");

export const optionalEmail = trim
  .refine((v) => v === "" || EMAIL_RE.test(v), "Geçerli bir email girin.")
  .refine((v) => v.length <= 120, "Email çok uzun.")
  .transform((v) => (v === "" ? null : v));

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  trim
    .refine(
      (v) => v === "" || (values as readonly string[]).includes(v),
      "Geçersiz seçim.",
    )
    .transform((v) => (v === "" ? null : (v as T[number])));

export const requiredEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  trim
    .refine(
      (v) => (values as readonly string[]).includes(v),
      "Geçersiz seçim.",
    )
    .transform((v) => v as T[number]);

export const optionalDate = trim
  .refine(
    (v) => v === "" || !Number.isNaN(Date.parse(v)),
    "Geçerli bir tarih girin.",
  )
  .transform((v) => (v === "" ? null : new Date(v)));

export const requiredDateTime = trim
  .refine((v) => v.length > 0, "Tarih ve saat gerekli.")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Geçerli bir tarih girin.")
  .transform((v) => new Date(v));

export const optionalDateTime = trim
  .refine(
    (v) => v === "" || !Number.isNaN(Date.parse(v)),
    "Geçerli bir tarih girin.",
  )
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
    }, "Geçerli bir sayı girin.")
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
    }, "Geçerli bir tam sayı girin.")
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
    }, "Geçerli bir tam sayı girin.")
    .transform((v) => Number.parseInt(v, 10));

export const optionalMoneyCents = trim
  .refine((v) => {
    if (v === "") return true;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n < 10_000_000;
  }, "Geçerli bir tutar girin.")
  .transform((v) => (v === "" ? null : Math.round(Number(v.replace(",", ".")) * 100)));

export const requiredMoneyCents = trim
  .refine((v) => {
    if (v === "") return false;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n < 10_000_000;
  }, "Geçerli bir tutar girin.")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100));

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
