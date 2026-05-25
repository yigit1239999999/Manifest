"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createTreatmentAction } from "@/modules/treatments/actions";
import { toDateTimeInput } from "@/lib/format";

export function TreatmentForm({
  petId,
  visitId,
}: {
  petId: string;
  visitId?: string;
}) {
  const t = useTranslations("treatment");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(createTreatmentAction, {});
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

      <Field label={t("name")} error={state.fieldErrors?.name} required>
        <Input name="name" required />
      </Field>
      <Field
        label={t("performedAt")}
        error={state.fieldErrors?.performedAt}
        required
      >
        <Input
          type="datetime-local"
          name="performedAt"
          defaultValue={toDateTimeInput(new Date())}
          required
        />
      </Field>
      <Field label={t("code")} error={state.fieldErrors?.code}>
        <Input name="code" />
      </Field>
      <Field
        label={t("durationMinutes")}
        error={state.fieldErrors?.durationMinutes}
      >
        <Input type="number" min="0" name="durationMinutes" />
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
