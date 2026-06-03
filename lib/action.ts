// Server-action wrapper.
//
// `action()` adds session loading, structured logging, and AppError →
// FormState conversion (with i18n) to every server action. Next's
// `redirect()` and `notFound()` propagate untouched.
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
import { getTranslations } from "next-intl/server";
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
      log = logger.child({
        action: name,
        clinicId: ctx.clinicId,
        userId: ctx.userId,
      });
      log.info("action.start");
      const result = await handler(ctx, ...args);
      log.info("action.end");
      return result;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;

      if (error instanceof AppError) {
        log.warn("action.app_error", {
          code: error.code,
          messageKey: error.messageKey,
        });
        const state = await appErrorToFormState(error);
        return state as TReturn | FormState;
      }

      const message = error instanceof Error ? error.message : String(error);
      log.error("action.uncaught", {
        err: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      const userMessage = await uncaughtMessage(message);
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

async function appErrorToFormState(error: AppError): Promise<FormState> {
  if (error.code === "VALIDATION_FAILED" && error.details?.fieldErrors) {
    const raw = error.details.fieldErrors as Record<string, string[]>;
    try {
      const t = await getTranslations();
      const translated: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(raw)) {
        translated[field] = messages.map((m) =>
          m.startsWith("error.") ? t(m) : m,
        );
      }
      return { fieldErrors: translated };
    } catch {
      return { fieldErrors: raw };
    }
  }

  try {
    const t = await getTranslations();
    const vars: Record<string, string | number> = { ...error.messageVars };
    // If the helper passed `entityKey` (e.g. "error.entity.pet") we
    // resolve it to the localised noun first so it can slot into the
    // sentence template.
    if (typeof error.messageVars?.entityKey === "string") {
      vars.entity = t(error.messageVars.entityKey);
    }
    const message = t(error.messageKey, vars);
    return { error: message };
  } catch {
    // No request scope (e.g. when called from a worker): fall back to
    // the message key so at least something readable surfaces.
    return { error: error.messageKey };
  }
}

async function uncaughtMessage(devMessage: string): Promise<string> {
  if (process.env.NODE_ENV === "development") {
    return `Dev hata: ${devMessage}`;
  }
  try {
    const t = await getTranslations();
    return t("errors.generic");
  } catch {
    return "Something went wrong. Please try again.";
  }
}
