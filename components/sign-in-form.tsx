"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { signInAction } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@clinic.com"
          autoComplete="email"
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton size="lg" className="mt-1 w-full">
        <LogIn />
        Sign in
      </SubmitButton>
    </form>
  );
}
