"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { signIn, signOut } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parse, type FormState } from "@/lib/action";
import { signInSchema, signUpSchema } from "./schema";
import { createClinicWithOwner } from "./service";

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(signUpSchema, formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    await createClinicWithOwner(parsed.data);
  } catch (error) {
    const t = await getTranslations();
    if (error instanceof AppError && error.code === "CONFLICT") {
      return { fieldErrors: { email: [t(error.messageKey)] } };
    }
    logger.error("auth.signup.failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return { error: t("error.auth.signupFailed") };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/sign-in");
    throw error;
  }
  return {};
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(signInSchema, formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const t = await getTranslations();
      return { error: t("error.auth.invalidCredentials") };
    }
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}
