"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/format";
import { centsToInputValue } from "@/lib/money";
import { PAYMENT_METHODS } from "@/modules/invoices/schema";
import { recordPaymentAction } from "@/modules/invoices/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

export function PaymentForm({
  invoiceId,
  remainingCents,
  currency,
}: {
  invoiceId: string;
  remainingCents: number;
  currency: string;
}) {
  const locale = useLocale();
  const t = useTranslations("invoice");
  const tMethod = useTranslations("enum.paymentMethod");
  const tCommon = useTranslations("common");
  const form = useActionForm(recordPaymentAction, {});
  const { state, reset } = form;
  // `Input` is a plain function component and does not take a ref (it is a
  // B-line primitive; changing its signature is not this change's business),
  // so the field is found inside this wrapper instead.
  const amountBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
  }, [state.success, tCommon, reset]);

  const outstanding = Math.max(0, remainingCents);

  // Writes the outstanding amount into the field itself, not into a hidden
  // value added at submit time: the number has to be visible and editable,
  // and the caret is put after it so correcting it takes no extra click.
  const payFull = () => {
    const input = amountBox.current?.querySelector<HTMLInputElement>(
      'input[name="amount"]',
    );
    if (!input) return;
    input.value = centsToInputValue(locale, outstanding);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  return (
    <ActionForm form={form} className="flex flex-col gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div ref={amountBox} className="flex flex-col items-start gap-1.5">
        <Field
          label={t("payment.amount")}
          error={state.fieldErrors?.amount}
          // The outstanding balance is information, not a suggested value: a
          // placeholder disappears as soon as anyone types and reads like a
          // filled field until then.
          hint={t("payment.remaining", {
            amount: formatMoney({ locale }, outstanding, currency),
          })}
          className="w-full"
          required
        >
          <Input
            name="amount"
            inputMode="decimal"
            placeholder={centsToInputValue(locale, 0)}
            required
          />
        </Field>
        {outstanding > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={payFull}>
            {t("payment.payFull")}
          </Button>
        )}
      </div>
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
