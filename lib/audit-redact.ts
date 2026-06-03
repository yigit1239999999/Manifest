// Sanitize values that flow into AuditLog.changes / metadata.
//
// Two guarantees:
//   1. Reserved keys (password, token, …) are replaced by the literal
//      string "[REDACTED]" instead of being written verbatim.
//   2. The output is a plain JSON-serialisable tree — Dates become ISO
//      strings, undefined drops out, and anything Prisma's Json type
//      would reject is cleaned up at the boundary.

import type { Prisma } from "@/generated/prisma/client";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const DEFAULT_RESERVED_KEYS = [
  "password",
  "passwordHash",
  "passwordConfirmation",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
];

function toJson(value: unknown): Json {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as object)) {
      out[k] = toJson(v);
    }
    return out;
  }
  return null;
}

export function redact(
  input: Record<string, unknown> | null | undefined,
  reservedKeys: readonly string[] = DEFAULT_RESERVED_KEYS,
): Prisma.InputJsonValue {
  if (input == null) return {} as Prisma.InputJsonValue;
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(input)) {
    if (reservedKeys.includes(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = toJson(value);
    }
  }
  return out as Prisma.InputJsonValue;
}

export function computeDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: readonly (keyof T)[],
): Prisma.InputJsonValue {
  const diff: Record<string, Json> = {};
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (!Object.is(a, b)) {
      diff[String(key)] = { from: toJson(a), to: toJson(b) };
    }
  }
  return diff as Prisma.InputJsonValue;
}
