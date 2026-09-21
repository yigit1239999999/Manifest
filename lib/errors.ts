// Typed domain errors. Services throw AppError; the server-action wrapper
// translates `messageKey` against the user's locale and converts the
// result into a FormState. Anything that isn't an AppError is unexpected.

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    /** next-intl key, resolved by lib/action's `appErrorToFormState`. */
    public readonly messageKey: string,
    /** Interpolation vars for the i18n key. Keep them JSON-serialisable. */
    public readonly messageVars?: Record<string, string | number>,
    /** Structured payload (e.g. fieldErrors for VALIDATION_FAILED). */
    public readonly details?: Record<string, unknown>,
  ) {
    // Fallback message used when running outside a translator (logs / tests).
    super(messageKey);
    this.name = "AppError";
  }
}

/**
 * `entity` is one of the keys under `error.entity.*` in the messages
 * catalogue (e.g. "client", "pet"). The wrapper resolves the noun for
 * the active locale and slots it into the "{entity} not found." template.
 */
export const notFound = (
  entity: keyof EntityNouns,
  id?: string,
): AppError =>
  new AppError("NOT_FOUND", "error.notFound", {
    entityKey: `error.entity.${entity}`,
    id: id ?? "",
  });

export const validationFailed = (
  fieldErrors: Record<string, string[]>,
): AppError =>
  new AppError("VALIDATION_FAILED", "error.validationFailed", undefined, {
    fieldErrors,
  });

export const forbidden = (messageKey = "error.forbidden"): AppError =>
  new AppError("FORBIDDEN", messageKey);

export const conflict = (messageKey: string): AppError =>
  new AppError("CONFLICT", messageKey);

/**
 * A unique index refused the row.
 *
 * Not the same predicate as `lostTheRace` in
 * `modules/appointments/service.ts`, which also accepts P2034: that one
 * wraps a serializable transaction and a serialization failure is one of
 * its ordinary outcomes. Here there is no transaction to retry -- the
 * only question is whether somebody else inserted the same row first --
 * so widening it would swallow a different kind of failure.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

// Compile-time roster of every entity key that lives under
// `error.entity.*` in messages/{en,tr}.json. Keep these in sync.
export type EntityNouns = {
  client: true;
  pet: true;
  visit: true;
  appointment: true;
  vaccination: true;
  prescription: true;
  treatment: true;
  diagnostic: true;
  note: true;
  reminder: true;
  invoice: true;
  user: true;
  clinic: true;
  species: true;
};
