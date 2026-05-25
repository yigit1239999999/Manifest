"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_METHODS } from "@/modules/invoices/schema";
import { recordPaymentAction } from "@/modules/invoices/actions";

export function PaymentForm({
  invoiceId,
  remainingCents,
}: {
  invoiceId: string;
  remainingCents: number;
}) {
  const t = useTranslations("invoice");
  const tMethod = useTranslations("enum.paymentMethod");
  const [state, formAction] = useActionState(recordPaymentAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Field label={t("payment.amount")} error={state.fieldErrors?.amountCents} required>
        <Input
          name="amountCents"
          placeholder={String(Math.max(0, remainingCents))}
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
    </form>
  );
}
