"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { DIAGNOSTIC_TYPES } from "@/modules/diagnostics/schema";
import { createDiagnosticAction } from "@/modules/diagnostics/actions";
import { toDateTimeInput } from "@/lib/format";

export function DiagnosticForm({
  petId,
  visitId,
}: {
  petId: string;
  visitId?: string;
}) {
  const t = useTranslations("diagnostic");
  const tType = useTranslations("enum.diagnosticType");
  const [state, formAction] = useActionState(createDiagnosticAction, {});
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

      <Field label={t("type")} error={state.fieldErrors?.type} required>
        <Select name="type" defaultValue="BLOOD" required>
          {DIAGNOSTIC_TYPES.map((d) => (
            <option key={d} value={d}>
              {tType(d)}
            </option>
          ))}
        </Select>
      </Field>
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
      <div className="sm:col-span-2">
        <Field label={t("result")} error={state.fieldErrors?.result}>
          <Textarea name="result" rows={3} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field
          label={t("interpretation")}
          error={state.fieldErrors?.interpretation}
        >
          <Textarea name="interpretation" rows={2} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </form>
  );
}
