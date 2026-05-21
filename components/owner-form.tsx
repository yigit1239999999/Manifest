"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import type { FormState } from "@/lib/validations";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";

type OwnerDefaults = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export function OwnerForm({
  action,
  defaultValues,
  submitLabel = "Save client",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: OwnerDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          htmlFor="firstName"
          required
          error={state.fieldErrors?.firstName}
        >
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaultValues?.firstName ?? ""}
            placeholder="Jamie"
            required
          />
        </Field>
        <Field
          label="Last name"
          htmlFor="lastName"
          required
          error={state.fieldErrors?.lastName}
        >
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaultValues?.lastName ?? ""}
            placeholder="Rivera"
            required
          />
        </Field>
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="jamie@email.com"
          />
        </Field>
        <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
            placeholder="(555) 123-4567"
          />
        </Field>
      </div>

      <Field label="Address" htmlFor="address" error={state.fieldErrors?.address}>
        <Input
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          placeholder="123 Maple Street, Springfield"
        />
      </Field>

      <Field
        label="Notes"
        htmlFor="notes"
        error={state.fieldErrors?.notes}
        hint="Anything helpful to remember about this client."
      >
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={3}
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
