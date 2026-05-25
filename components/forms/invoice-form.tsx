"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Client } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";
import { createInvoiceAction } from "@/modules/invoices/actions";

interface Line {
  description: string;
  quantity: string;
  unitPrice: string;
}

const emptyLine: Line = { description: "", quantity: "1", unitPrice: "" };

interface Props {
  clients: Pick<Client, "id" | "firstName" | "lastName">[];
  defaultClientId?: string;
  defaultNumber?: string;
}

export function InvoiceForm({ clients, defaultClientId, defaultNumber }: Props) {
  const t = useTranslations("invoice");
  const tStatus = useTranslations("enum.invoiceStatus");
  const tClient = useTranslations("client");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [state, formAction] = useActionState(createInvoiceAction, {});

  const addLine = () => setLines((ls) => [...ls, { ...emptyLine }]);
  const removeLine = (i: number) =>
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.fieldErrors?.lines && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.fieldErrors.lines[0]}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tClient("title")} error={state.fieldErrors?.clientId} required>
          <Select name="clientId" defaultValue={defaultClientId ?? ""} required>
            <option value="" disabled>
              —
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("number")} error={state.fieldErrors?.number} required>
          <Input name="number" defaultValue={defaultNumber} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("status")} error={state.fieldErrors?.status} required>
          <Select name="status" defaultValue="DRAFT" required>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dueAt")} error={state.fieldErrors?.dueAt}>
          <Input type="datetime-local" name="dueAt" />
        </Field>
      </div>

      <Field label={t("tax")} error={state.fieldErrors?.taxCents}>
        <Input name="taxCents" placeholder="0.00" />
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t("lines")}</p>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_80px_120px_auto]"
          >
            <Input
              name={`lines[${i}].description`}
              placeholder={t("description")}
              value={line.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              required={i === 0}
            />
            <Input
              name={`lines[${i}].quantity`}
              type="number"
              min="1"
              placeholder={t("quantity")}
              value={line.quantity}
              onChange={(e) => updateLine(i, { quantity: e.target.value })}
              required={i === 0}
            />
            <Input
              name={`lines[${i}].unitPriceCents`}
              placeholder={t("unitPrice")}
              value={line.unitPrice}
              onChange={(e) => {
                const cents = Math.round(
                  Number((e.target.value || "0").replace(",", ".")) * 100,
                );
                updateLine(i, { unitPrice: String(cents) });
              }}
              required={i === 0}
            />
            {lines.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLine(i)}
              >
                {t("removeLine")}
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addLine}>
          + {t("addLine")}
        </Button>
      </div>

      <Field label={t("notes")} error={state.fieldErrors?.notes}>
        <Textarea name="notes" rows={3} />
      </Field>

      <SubmitButton>{t("create")}</SubmitButton>
    </form>
  );
}
