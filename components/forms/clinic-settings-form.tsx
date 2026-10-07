"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/format";
import { CURRENCIES } from "@/modules/clinics/schema";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  currency: string;
  /** Used to say what stays as it is; the question is empty without it. */
  invoiceCount: number;
}

export function ClinicSettingsForm({ action, currency, invoiceCount }: Props) {
  const locale = useLocale();
  const t = useTranslations("settings.clinic");
  const tCommon = useTranslations("common");
  const form = useActionForm(action, {});
  const { state } = form;
  const [selected, setSelected] = useState(currency);

  const savedMessage = t("saved");

  // Resolved BEFORE the effect, and the effect depends on the string
  // rather than on the translator. `useTranslations` hands back a new
  // function identity on a re-render, so a dependency array holding it
  // re-runs for a render that changed nothing -- and one save produces
  // two toasts. A string is equal to itself. pm reproduced the double
  // on this form 3/3 and proved the mechanism with a control: the
  // species card depends on a string and fires once.
  useEffect(() => {
    if (state.success) toast.success(savedMessage);
  }, [state.success, savedMessage]);

  const changed = selected !== currency;
  // Real numbers, not an invented example: the clinic's own invoice count
  // and the same amount written both ways.
  const example = `${formatMoney({ locale }, 50_000, currency)} → ${formatMoney(
    { locale },
    50_000,
    selected,
  )}`;

  return (
    <ActionForm form={form} className="flex flex-col gap-4">

      <Field
        label={t("currency")}
        error={state.fieldErrors?.currency}
        hint={t("currencyHint")}
      >
        <Select
          name="currency"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {t(`currency_${c}`)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex justify-end">
        {/* Asked only when there is something to be careful about. An empty
            clinic has no past invoices to reassure anyone about, and the
            dialog would be a toll booth. The tone is `default`: this is a
            reversible setting, not a deletion. */}
        {changed && invoiceCount > 0 ? (
          <ConfirmDialog
            title={t("currencyConfirmTitle", { currency: t(`currency_${selected}`) })}
            description={t("currencyConfirmBody", { count: invoiceCount, example })}
            confirmLabel={t("save")}
            cancelLabel={tCommon("nevermind")}
            tone="default"
            // The dialog calls this rather than submitting anything, so
            // the chosen value is put into the form data here. It used to
            // say "the dialog submits its own form" — which was true, and
            // was the bug: a `<form>` inside this one is invalid HTML, the
            // browser dropped it, and the currency silently never saved.
            action={async () => {
              const data = new FormData();
              data.set("currency", selected);
              form.formAction(data);
            }}
          >
            {(open) => (
              <button
                type="button"
                onClick={open}
                className={buttonVariants({ size: "md" })}
              >
                {t("save")}
              </button>
            )}
          </ConfirmDialog>
        ) : (
          <SubmitButton>{t("save")}</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
