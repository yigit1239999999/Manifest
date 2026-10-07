"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SubmitButton } from "@/components/submit-button";
import { createTreatmentAction } from "@/modules/treatments/actions";
import { TREATMENTS } from "@/lib/procedures";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { AllergyOverride } from "@/components/forms/allergy-override";
import { findAllergyConflict } from "@/lib/allergy-check";

const TREATMENT_OPTIONS = TREATMENTS.map((name) => ({ value: name, label: name }));

export function TreatmentForm({
  petId,
  visitId,
  vets = [],
  defaultVetId,
  alerts,
}: {
  petId: string;
  visitId?: string;
  vets?: { id: string; name: string }[];
  defaultVetId?: string;
  /** The animal's medical alerts; see `PrescriptionForm`. */
  alerts?: string | null;
}) {
  const t = useTranslations("treatment");
  const tCommon = useTranslations("common");
  const form = useActionForm(createTreatmentAction, {});
  const { state, reset } = form;

  const savedMessage = tCommon("saved");
  const tCheck = useTranslations("allergyCheck");

  // A treatment is often a drug given here ("Amoksisilin enjeksiyonu"),
  // so it gets the prescription form's check. See there.
  // Tagged with the form's reset count, so a saved form forgets the name
  // with everything else instead of a state update in the save effect.
  const [typed, setTyped] = useState({ token: 0, value: "" });
  const name = typed.token === form.resetToken ? typed.value : "";
  const refused = state.allergyConflict;
  const conflict =
    findAllergyConflict(alerts, name) ??
    (refused && (!name || name.trim() === refused.drug) ? refused : null);

  // The message is resolved BEFORE the effect and the effect depends on
  // the string, not on the translator. `useTranslations` hands back a
  // new function identity on a re-render, so a dependency array holding
  // it re-runs the effect for a render that changed nothing -- and the
  // user gets a second toast for one save. A string is equal to itself.
  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(savedMessage);
    }
  }, [state.success, savedMessage, reset]);

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
            onValueChange={(value) => setTyped({ token: form.resetToken, value })}
          />
        </Field>
      </div>
      {conflict && (
        <AllergyOverride
          conflict={conflict}
          fieldErrors={state.fieldErrors?.overrideReason}
        />
      )}

      <Field label={t("performedAt")} error={state.fieldErrors?.performedAt} required>
        <DateTimeInput
          name="performedAt"
          defaultValue={new Date()}
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
      <SubmitButton
        size="sm"
        variant={conflict ? "destructive" : undefined}
        className="w-fit sm:col-span-2"
      >
        {conflict ? tCheck("submitAnyway") : t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
