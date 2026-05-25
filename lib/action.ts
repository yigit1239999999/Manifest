// Server-action wrapper.
//
// `action()` adds session loading, structured logging, and AppError →
// FormState conversion to every server action. Next's `redirect()` and
// `notFound()` propagate untouched.
//
// Usage:
//
//   export const createPetAction = action(
//     "pet.create",
//     async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
//       const parsed = parse(petSchema, formData);
//       if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
//       const pet = await createPet(parsed.data, ctx); // throws AppError on failure
//       revalidatePath("/pets");
//       redirect(`/pets/${pet.id}`);
//     },
//   );

import type { ZodError, ZodType } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";
import { requireSession } from "./session";

export type FormState = {
  fieldErrors?: Record<string, string[]>;
  error?: string;
  success?: boolean;
};

export interface ActionContext {
  clinicId: string;
  userId: string;
  userName: string;
  userRole: string;
}

export function action<TArgs extends unknown[], TReturn extends FormState | void>(
  name: string,
  handler: (ctx: ActionContext, ...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn | FormState> {
  return async (...args: TArgs) => {
    let log = logger.child({ action: name });
    try {
      const session = await requireSession();
      const ctx: ActionContext = {
        clinicId: session.user.clinicId,
        userId: session.user.id,
        userName: session.user.name ?? "",
        userRole: session.user.role ?? "",
      };
      log = logger.child({ action: name, clinicId: ctx.clinicId, userId: ctx.userId });
      log.info("action.start");
      const result = await handler(ctx, ...args);
      log.info("action.end");
      return result;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;

      if (error instanceof AppError) {
        log.warn("action.app_error", { code: error.code, message: error.message });
        return appErrorToFormState(error) as TReturn | FormState;
      }

      const message = error instanceof Error ? error.message : String(error);
      log.error("action.uncaught", {
        err: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      const userMessage =
        process.env.NODE_ENV === "development"
          ? `Dev hata: ${message}`
          : "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.";
      return { error: userMessage } as TReturn | FormState;
    }
  };
}

export function parse<T>(
  schema: ZodType<T>,
  formData: FormData,
):
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, fieldErrors: zodToFieldErrors(result.error) };
}

export function zodToFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] as string | undefined) ?? "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function isNextControlFlow(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as Error & { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}

function appErrorToFormState(error: AppError): FormState {
  if (error.code === "VALIDATION_FAILED" && error.details?.fieldErrors) {
    return { fieldErrors: error.details.fieldErrors as Record<string, string[]> };
  }
  return { error: error.message };
}
