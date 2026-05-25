"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { PRESCRIPTION_STATUSES } from "@/modules/prescriptions/schema";
import { createPrescriptionAction } from "@/modules/prescriptions/actions";
import { toDateTimeInput } from "@/lib/format";

export function PrescriptionForm({
  petId,
  visitId,
}: {
  petId: string;
  visitId?: string;
}) {
  const t = useTranslations("prescription");
  const tStatus = useTranslations("enum.prescriptionStatus");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(createPrescriptionAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon]);

  return (
    <form
      action={formAction}
      ref={formRef}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <Field
        label={t("medicationName")}
        error={state.fieldErrors?.medicationName}
        required
      >
        <Input name="medicationName" required />
      </Field>
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
        <Input
          type="datetime-local"
          name="startedAt"
          defaultValue={toDateTimeInput(new Date())}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("instructions")} error={state.fieldErrors?.instructions}>
          <Textarea name="instructions" rows={2} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </form>
  );
}
