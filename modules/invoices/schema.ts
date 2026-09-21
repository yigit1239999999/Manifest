import { z } from "zod";
import {
  msg,
  optionalDateTime,
  optionalMoney,
  optionalText,
  requiredEnum,
  requiredId,
  requiredMoney,
  requiredText,
} from "@/lib/forms";

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIAL",
  "PAID",
  "VOID",
] as const;

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "CHECK",
  "OTHER",
] as const;

// Money fields are named for what a person types — an amount — not for the
// unit it is stored in. A field called `amountCents` invites both the user
// and the next developer to put cents in it, which is exactly how a payment
// of 500 was once recorded as 5,00.
//
// The schemas are built per request because an amount cannot be read without
// knowing the locale it was typed in (see lib/money.ts).
const invoiceLineSchema = (locale: string) =>
  z.object({
    description: requiredText(1, 200, "invoice.description"),
    quantity: z.coerce.number().int().min(1).max(10_000),
    unitPrice: requiredMoney(locale, { maxCents: 10_000_000 }),
    petId: z.string().optional().transform((v) => v || null),
    visitId: z.string().optional().transform((v) => v || null),
  });

export const invoiceSchema = (locale: string) =>
  z.object({
    clientId: requiredId("error.entity.client"),
    number: requiredText(1, 40, "invoice.number"),
    status: requiredEnum(INVOICE_STATUSES),
    dueAt: optionalDateTime,
    tax: optionalMoney(locale),
    notes: optionalText(2000),
    lines: z.array(invoiceLineSchema(locale)).min(1, msg("error.form.linesRequired")),
  });

export const paymentSchema = (locale: string) =>
  z.object({
    invoiceId: z.string().min(1),
    amount: requiredMoney(locale, { minCents: 1, maxCents: 10_000_000 }),
    method: requiredEnum(PAYMENT_METHODS),
    reference: optionalText(120),
    notes: optionalText(500),
  });

export type InvoiceInput = z.infer<ReturnType<typeof invoiceSchema>>;
export type PaymentInput = z.infer<ReturnType<typeof paymentSchema>>;
