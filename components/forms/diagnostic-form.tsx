"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SubmitButton } from "@/components/submit-button";
import { DIAGNOSTIC_TYPES } from "@/modules/diagnostics/schema";
import { createDiagnosticAction } from "@/modules/diagnostics/actions";
import { toDateTimeInput } from "@/lib/format";
import { DIAGNOSTIC_TESTS } from "@/lib/procedures";

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
  const [state, formAction] = useActionState(createDiagnosticAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<string>("BLOOD");

  // The test list follows the chosen type (blood work vs imaging vs ...).
  const testOptions = useMemo(
    () => (DIAGNOSTIC_TESTS[type] ?? []).map((name) => ({ value: name, label: name })),
    [type],
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon]);

  return (
    <form action={formAction} ref={formRef} className="grid gap-3 sm:grid-cols-2">
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
        <Input
          type="datetime-local"
          name="performedAt"
          defaultValue={toDateTimeInput(new Date())}
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
    </form>
  );
}
