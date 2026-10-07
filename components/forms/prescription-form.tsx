"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { PRESCRIPTION_STATUSES } from "@/modules/prescriptions/schema";
import { createPrescriptionAction } from "@/modules/prescriptions/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { AllergyOverride } from "@/components/forms/allergy-override";
import { findAllergyConflict } from "@/lib/allergy-check";

export function PrescriptionForm({
  petId,
  visitId,
  alerts,
}: {
  petId: string;
  visitId?: string;
  /**
   * The animal's medical alerts (allergies, "bites"). Repeated here, next
   * to the drug name, because the page's own warning is a screen higher by
   * the time anyone writes a prescription: a vet entered amoxicillin for a
   * cat whose penicillin allergy was out of sight above.
   */
  alerts?: string | null;
}) {
  const tPet = useTranslations("pet");
  const t = useTranslations("prescription");
  const tStatus = useTranslations("enum.prescriptionStatus");
  const tCommon = useTranslations("common");
  const form = useActionForm(createPrescriptionAction, {});
  const { state, reset } = form;

  const savedMessage = tCommon("saved");
  const tCheck = useTranslations("allergyCheck");

  // Checked as the name is typed, so the warning arrives before the save
  // rather than as its refusal. The server repeats the check and is the
  // one that blocks; its answer is the fallback here for a page whose
  // script had not run yet.
  // Tagged with the form's reset count, so a saved form forgets the name
  // with everything else instead of a state update in the save effect.
  const [typed, setTyped] = useState({ token: 0, value: "" });
  const drug = typed.token === form.resetToken ? typed.value : "";
  const refused = state.allergyConflict;
  const conflict =
    findAllergyConflict(alerts, drug) ??
    (refused && (!drug || drug.trim() === refused.drug) ? refused : null);

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
    <ActionForm
      form={form}
      className="grid gap-3 sm:grid-cols-2"
    >

      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}
      {alerts && (
        <Callout
          variant="warning"
          title={tPet("alerts")}
          className="col-span-full"
        >
          {alerts}
        </Callout>
      )}

      <Field
        label={t("medicationName")}
        error={state.fieldErrors?.medicationName}
        required
      >
        <Input
          name="medicationName"
          required
          onChange={(e) => setTyped({ token: form.resetToken, value: e.currentTarget.value })}
        />
      </Field>
      {/* Directly under the drug, where the eye is as it is typed, not
          at the foot of the form after nine more fields. */}
      {conflict && (
        <AllergyOverride
          conflict={conflict}
          fieldErrors={state.fieldErrors?.overrideReason}
        />
      )}
      <Field label={t("status")} error={state.fieldErrors?.status} required>
        <Select name="status" defaultValue="ACTIVE" required>
          {PRESCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("dosage")} error={state.fieldErrors?.dosage} required>
        <Input name="dosage" required />
      </Field>
      <Field
        label={t("frequency")}
        error={state.fieldErrors?.frequency}
        required
      >
        <Input name="frequency" required />
      </Field>
      <Field label={t("route")} error={state.fieldErrors?.route}>
        <Input name="route" />
      </Field>
      <Field
        label={t("durationDays")}
        error={state.fieldErrors?.durationDays}
      >
        <Input type="number" min="0" name="durationDays" />
      </Field>
      <Field label={t("refills")} error={state.fieldErrors?.refills}>
        <Input type="number" min="0" name="refills" defaultValue="0" />
      </Field>
      <Field label={t("startedAt")} error={state.fieldErrors?.startedAt} required>
        <DateTimeInput
          name="startedAt"
          defaultValue={new Date()}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("instructions")} error={state.fieldErrors?.instructions}>
          <Textarea name="instructions" rows={2} />
        </Field>
      </div>
      <SubmitButton
        size="sm"
        variant={conflict ? "destructive" : undefined}
        className="sm:col-span-2 w-fit"
      >
        {conflict ? tCheck("submitAnyway") : t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
