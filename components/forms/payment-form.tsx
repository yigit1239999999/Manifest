"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { centsToInputValue } from "@/lib/money";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_METHODS } from "@/modules/invoices/schema";
import { recordPaymentAction } from "@/modules/invoices/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

export function PaymentForm({
  invoiceId,
  remainingCents,
}: {
  invoiceId: string;
  remainingCents: number;
}) {
  const locale = useLocale();
  const t = useTranslations("invoice");
  const tMethod = useTranslations("enum.paymentMethod");
  const tCommon = useTranslations("common");
  const form = useActionForm(recordPaymentAction, {});
  const { state, reset } = form;

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error, tCommon, reset]);

  return (
    <ActionForm form={form} className="flex flex-col gap-3">
      {state.error && <Callout variant="danger">{state.error}</Callout>}
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Field label={t("payment.amount")} error={state.fieldErrors?.amountCents} required>
        <Input
          name="amountCents"
          inputMode="decimal"
          // The outstanding amount, written the way this locale writes money:
          // the old hint showed raw cents and taught people to type them.
          placeholder={centsToInputValue(locale, Math.max(0, remainingCents))}
          required
        />
      </Field>
      <Field label={t("payment.method")} error={state.fieldErrors?.method} required>
        <Select name="method" required defaultValue="CARD">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {tMethod(m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("payment.reference")} error={state.fieldErrors?.reference}>
        <Input name="reference" />
      </Field>
      <SubmitButton size="sm" className="w-fit">
        {t("payment.submit")}
      </SubmitButton>
    </ActionForm>
  );
}
