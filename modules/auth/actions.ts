"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
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
    if (error instanceof AppError && error.code === "CONFLICT") {
      return { fieldErrors: { email: [error.message] } };
    }
    logger.error("auth.signup.failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return { error: "Kayıt sırasında bir hata oluştu. Tekrar deneyin." };
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
      return { error: "Email veya şifre hatalı." };
    }
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}
