"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createVaccinationAction } from "@/modules/vaccinations/actions";
import { toDateTimeInput } from "@/lib/format";

export function VaccinationForm({
  petId,
  visitId,
}: {
  petId: string;
  visitId?: string;
}) {
  const t = useTranslations("vaccination");
  const [state, formAction] = useActionState(createVaccinationAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      action={formAction}
      ref={formRef}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <Field label={t("name")} error={state.fieldErrors?.name} required>
        <Input name="name" required />
      </Field>
      <Field
        label={t("administeredAt")}
        error={state.fieldErrors?.administeredAt}
        required
      >
        <Input
          type="datetime-local"
          name="administeredAt"
          defaultValue={toDateTimeInput(new Date())}
          required
        />
      </Field>
      <Field label={t("manufacturer")} error={state.fieldErrors?.manufacturer}>
        <Input name="manufacturer" />
      </Field>
      <Field label={t("lotNumber")} error={state.fieldErrors?.lotNumber}>
        <Input name="lotNumber" />
      </Field>
      <Field label={t("nextDueAt")} error={state.fieldErrors?.nextDueAt}>
        <Input type="datetime-local" name="nextDueAt" />
      </Field>
      <Field label={t("site")} error={state.fieldErrors?.site}>
        <Input name="site" />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("notes")} error={state.fieldErrors?.notes}>
          <Textarea name="notes" rows={2} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </form>
  );
}
