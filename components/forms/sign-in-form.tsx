"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { signInAction } from "@/modules/auth/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

export function SignInForm() {
  const t = useTranslations("auth");
  const form = useActionForm(signInAction, {});
  const { state } = form;

  return (
    <ActionForm form={form} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Field label={t("email")} error={state.fieldErrors?.email} required>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t("password")} error={state.fieldErrors?.password} required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="mt-2 w-full">{t("signInButton")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/sign-up"
          className="font-medium text-primary hover:underline"
        >
          {t("needAccount")}
        </Link>
      </p>
    </ActionForm>
  );
}
