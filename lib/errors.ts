// Typed domain errors. Services throw AppError; the server-action wrapper
// converts them to FormState. Anything not an AppError is unexpected.

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
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (entity: string, id?: string): AppError =>
  new AppError(
    "NOT_FOUND",
    id ? `${entity} (${id}) bulunamadı.` : `${entity} bulunamadı.`,
  );

export const validationFailed = (
  fieldErrors: Record<string, string[]>,
): AppError =>
  new AppError("VALIDATION_FAILED", "Lütfen formu kontrol et.", { fieldErrors });

export const forbidden = (message = "Bu işlem için yetkin yok."): AppError =>
  new AppError("FORBIDDEN", message);

export const conflict = (message: string): AppError =>
  new AppError("CONFLICT", message);
