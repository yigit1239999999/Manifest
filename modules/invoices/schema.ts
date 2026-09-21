import { z } from "zod";
import {
  msg,
  optionalDateTime,
  optionalMoneyCents,
  optionalText,
  requiredEnum,
  requiredId,
  requiredMoneyCents,
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

const invoiceLineSchema = z.object({
  description: requiredText(1, 200, "invoice.description"),
  quantity: z.coerce.number().int().min(1).max(10_000),
  // The form sends what the user typed ("1.234,56"); the helper is the only
  // thing that turns it into cents.
  unitPriceCents: requiredMoneyCents({ maxCents: 10_000_000 }),
  petId: z.string().optional().transform((v) => v || null),
  visitId: z.string().optional().transform((v) => v || null),
});

export const invoiceSchema = z.object({
  clientId: requiredId("error.entity.client"),
  number: requiredText(1, 40, "invoice.number"),
  status: requiredEnum(INVOICE_STATUSES),
  dueAt: optionalDateTime,
  taxCents: optionalMoneyCents(),
  notes: optionalText(2000),
  lines: z.array(invoiceLineSchema).min(1, msg("error.form.linesRequired")),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: requiredMoneyCents({ minCents: 1, maxCents: 10_000_000 }),
  method: requiredEnum(PAYMENT_METHODS),
  reference: optionalText(120),
  notes: optionalText(500),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
