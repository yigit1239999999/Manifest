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
import { MESSAGE_PREFIX } from "./forms";
import { logger } from "./logger";
import { requireSession } from "./session";

export type FormState = {
  fieldErrors?: Record<string, string[]>;
  error?: string;
  success?: boolean;
  /**
   * What the user submitted, echoed back so the form can refill itself after
   * a failed validation (React resets uncontrolled inputs once the action
   * returns). Sensitive fields are stripped — see `submittedValues`.
   */
  values?: Record<string, string>;
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
    // Kept aside so any error state can carry the submission back to the
    // form; without it React clears every uncontrolled field.
    const formData = args.find((a): a is FormData => a instanceof FormData);
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
      return (await finalizeState(result, formData)) as TReturn | FormState;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;

      if (error instanceof AppError) {
        log.warn("action.app_error", {
          code: error.code,
          messageKey: error.messageKey,
        });
        const state = await appErrorToFormState(error);
        return withValues(state, formData) as TReturn | FormState;
      }

      const message = error instanceof Error ? error.message : String(error);
      log.error("action.uncaught", {
        err: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      const userMessage = await uncaughtMessage(message);
      return withValues({ error: userMessage }, formData) as TReturn | FormState;
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

// Field names whose values must never travel back to the browser.
const SENSITIVE = /password|secret|token|otp/i;

/** Plain string entries of a submission, minus secrets and framework noise. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("$ACTION") || SENSITIVE.test(key)) continue;
    if (value.length > 20_000) continue;
    values[key] = value;
  }
  return values;
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

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Resolves the encoded messages a schema produced (see `msg` in lib/forms.ts)
 * into sentences in the request's locale. Plain sentences pass through, so a
 * message written by hand still works.
 */
function translateMessage(t: Translator, raw: string): string {
  let key = raw;
  let params: Record<string, string | number> = {};

  if (raw.startsWith(MESSAGE_PREFIX)) {
    const rest = raw.slice(MESSAGE_PREFIX.length);
    const sep = rest.indexOf(":");
    key = sep === -1 ? rest : rest.slice(0, sep);
    if (sep !== -1) {
      try {
        params = JSON.parse(rest.slice(sep + 1));
      } catch {
        params = {};
      }
    }
  } else if (!raw.startsWith("error.")) {
    return raw;
  }

  // A `field` param names another message (the field's label), e.g.
  // "pet.owner" → "Owner", so it can slot into the sentence.
  if (typeof params.field === "string") {
    params.field = translate(t, params.field, {}, params.field);
  }
  return translate(t, key, params, raw);
}

function translate(
  t: Translator,
  key: string,
  params: Record<string, string | number>,
  fallback: string,
): string {
  try {
    const message = t(key, params);
    // next-intl returns the key itself when a message is missing.
    return message === key ? fallback : message;
  } catch {
    return fallback;
  }
}

/** Echoes the submission back on any state that reports a problem. */
function withValues(state: FormState, formData?: FormData): FormState {
  if (!formData) return state;
  if (!state.fieldErrors && !state.error) return state;
  if (state.values) return state;
  return { ...state, values: submittedValues(formData) };
}

/**
 * Prepares a state a handler returned for the client: messages localised and
 * the submitted values attached so nothing the user typed is lost.
 */
export async function finalizeState<T>(result: T, formData?: FormData): Promise<T> {
  const state = result as FormState | undefined | null;
  if (!state || typeof state !== "object") return result;
  if (!state.fieldErrors && !state.error) return result;

  let t: Translator;
  try {
    t = await getTranslations();
  } catch {
    return withValues(state, formData) as T;
  }

  const next: FormState = { ...withValues(state, formData) };
  if (state.fieldErrors) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(state.fieldErrors)) {
      fieldErrors[field] = messages.map((m) => translateMessage(t, m));
    }
    next.fieldErrors = fieldErrors;
  }
  if (state.error) next.error = translateMessage(t, state.error);
  return next as T;
}

async function appErrorToFormState(error: AppError): Promise<FormState> {
  if (error.code === "VALIDATION_FAILED" && error.details?.fieldErrors) {
    const raw = error.details.fieldErrors as Record<string, string[]>;
    try {
      const t = await getTranslations();
      const translated: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(raw)) {
        translated[field] = messages.map((m) => translateMessage(t, m));
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
  try {
    const t = await getTranslations();
    // Only development surfaces the underlying message; production always
    // gets the generic sentence so internal details never leak.
    return process.env.NODE_ENV === "development"
      ? t("error.dev", { message: devMessage })
      : t("error.generic");
  } catch {
    // No request scope (e.g. when called from a worker).
    return process.env.NODE_ENV === "development"
      ? `Dev error: ${devMessage}`
      : "Something went wrong. Please try again.";
  }
}
