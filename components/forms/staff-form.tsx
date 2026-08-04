"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { USER_ROLES } from "@/modules/staff/schema";
import { createStaffAction } from "@/modules/staff/actions";

export function StaffForm() {
  const t = useTranslations("staff");
  const tRole = useTranslations("enum.role");
  const [state, formAction] = useActionState(createStaffAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Field label={t("name")} error={state.fieldErrors?.name} required>
        <Input name="name" autoComplete="name" required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("email")} error={state.fieldErrors?.email} required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ornek@email.com"
            required
          />
        </Field>
        <Field label={t("phone")} error={state.fieldErrors?.phone}>
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("role")} error={state.fieldErrors?.role} required>
          <Select name="role" defaultValue="VETERINARIAN" required>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {tRole(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("password")}
          error={state.fieldErrors?.password}
          hint={t("passwordHint")}
          required
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      <SubmitButton>{t("create")}</SubmitButton>
    </form>
  );
}
