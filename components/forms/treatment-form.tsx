"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SubmitButton } from "@/components/submit-button";
import { createTreatmentAction } from "@/modules/treatments/actions";
import { toDateTimeInput } from "@/lib/format";
import { TREATMENTS } from "@/lib/procedures";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

const TREATMENT_OPTIONS = TREATMENTS.map((name) => ({ value: name, label: name }));

export function TreatmentForm({
  petId,
  visitId,
  vets = [],
  defaultVetId,
}: {
  petId: string;
  visitId?: string;
  vets?: { id: string; name: string }[];
  defaultVetId?: string;
}) {
  const t = useTranslations("treatment");
  const tCommon = useTranslations("common");
  const form = useActionForm(createTreatmentAction, {});
  const { state, reset } = form;

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon, reset]);

  return (
    <ActionForm form={form} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <div className="sm:col-span-2">
        <Field label={t("name")} error={state.fieldErrors?.name} required>
          <Combobox
            name="name"
            freeText
            required
            options={TREATMENT_OPTIONS}
            placeholder={t("namePlaceholder")}
            noResultsLabel={tCommon("noResults")}
          />
        </Field>
      </div>

      <Field label={t("performedAt")} error={state.fieldErrors?.performedAt} required>
        <Input
          type="datetime-local"
          name="performedAt"
          defaultValue={toDateTimeInput(new Date())}
          required
        />
      </Field>
      {vets.length > 0 && (
        <Field label={t("performedBy")} error={state.fieldErrors?.performedById}>
          <Select name="performedById" defaultValue={defaultVetId ?? ""}>
            <option value="">{tCommon("none")}</option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("durationMinutes")} error={state.fieldErrors?.durationMinutes}>
        <Input type="number" min="0" max="1440" name="durationMinutes" />
      </Field>
      <Field label={t("code")} error={state.fieldErrors?.code} hint={t("codeHint")}>
        <Input name="code" />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("notes")} error={state.fieldErrors?.notes}>
          <Textarea name="notes" rows={2} placeholder={t("notesPlaceholder")} />
        </Field>
      </div>
      <SubmitButton size="sm" className="w-fit sm:col-span-2">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
