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

  useEffect(() => {
    if (state.success) toast.success(t("saved"));
  }, [state.success, t]);

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
            // The dialog submits its own form, which holds no fields, so
            // the chosen value is handed over explicitly.
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
