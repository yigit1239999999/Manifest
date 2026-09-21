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

  const savedMessage = tCommon("saved");

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

      {/* Unticked by default, which is what three quarters of tests
          are. The two mistakes are not symmetrical: wrongly ticked
          fills the unread list with in-house results until nobody
          reads it, wrongly left loses one row. And the label says
          where it came from rather than asking whether somebody ought
          to read it -- that judgement is not the typist's to make.

          Above the two long text areas, not below them, and that is
          the placement rather than a tidy-up. It is a fact about the
          TEST -- what it is, when it was done, where it came from --
          so it belongs with the other three, and the asymmetry above
          decides the rest: the mistake that costs is forgetting to
          tick, and a checkbox under two textareas is the thing a
          typist pasting a long report scrolls past on the way to
          Save. */}
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="externalLab"
          className="mt-0.5 size-4 rounded border-border"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium">{t("externalLab")}</span>
          <span className="text-xs text-muted-foreground">{t("externalLabHint")}</span>
        </span>
      </label>
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
