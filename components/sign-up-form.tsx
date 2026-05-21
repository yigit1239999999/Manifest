"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Clinic name"
        htmlFor="clinicName"
        required
        error={state.fieldErrors?.clinicName}
      >
        <Input
          id="clinicName"
          name="clinicName"
          placeholder="Sunrise Veterinary Clinic"
          required
        />
      </Field>
      <Field label="Your name" htmlFor="name" required error={state.fieldErrors?.name}>
        <Input id="name" name="name" placeholder="Dr. Alex Morgan" required />
      </Field>
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
        hint="At least 8 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton size="lg" className="mt-1 w-full">
        <Sparkles />
        Create clinic account
      </SubmitButton>
    </form>
  );
}
