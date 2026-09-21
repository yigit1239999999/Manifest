"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SubmitButton } from "@/components/submit-button";
import { DIAGNOSTIC_TYPES } from "@/modules/diagnostics/schema";
import { createDiagnosticAction } from "@/modules/diagnostics/actions";
import { DIAGNOSTIC_TESTS } from "@/lib/procedures";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

export function DiagnosticForm({
  petId,
  visitId,
}: {
  petId: string;
  visitId?: string;
}) {
  const t = useTranslations("diagnostic");
  const tType = useTranslations("enum.diagnosticType");
  const tCommon = useTranslations("common");
  const form = useActionForm(createDiagnosticAction, {});
  const { state, reset } = form;
  const [type, setType] = useState<string>("BLOOD");

  // The test list follows the chosen type (blood work vs imaging vs ...).
  const testOptions = useMemo(
    () => (DIAGNOSTIC_TESTS[type] ?? []).map((name) => ({ value: name, label: name })),
    [type],
  );

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
  }, [state.success, tCommon, reset]);

  return (
    <ActionForm form={form} className="grid gap-3 sm:grid-cols-2">

      <input type="hidden" name="petId" value={petId} />
      {visitId && <input type="hidden" name="visitId" value={visitId} />}

      <Field label={t("type")} error={state.fieldErrors?.type} required>
        <Select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
        >
          {DIAGNOSTIC_TYPES.map((d) => (
            <option key={d} value={d}>
              {tType(d)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("performedAt")} error={state.fieldErrors?.performedAt} required>
        <DateTimeInput
          name="performedAt"
          defaultValue={new Date()}
          required
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label={t("name")} error={state.fieldErrors?.name} required>
          <Combobox
            key={type}
            name="name"
            freeText
            required
            options={testOptions}
            placeholder={t("namePlaceholder")}
            noResultsLabel={tCommon("noResults")}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label={t("result")} error={state.fieldErrors?.result}>
          <Textarea name="result" rows={3} placeholder={t("resultPlaceholder")} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("interpretation")} error={state.fieldErrors?.interpretation}>
          <Textarea
            name="interpretation"
            rows={2}
            placeholder={t("interpretationPlaceholder")}
          />
        </Field>
      </div>
      <SubmitButton size="sm" className="w-fit sm:col-span-2">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
