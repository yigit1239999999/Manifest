import { z } from "zod";
import {
  optionalDateTime,
  optionalMoneyCents,
  optionalText,
  requiredEnum,
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
  description: z.string().trim().min(1, "Açıklama gerekli."),
  quantity: z.coerce.number().int().min(1).max(10_000),
  unitPriceCents: z.coerce.number().int().min(0).max(10_000_000),
  petId: z.string().optional().transform((v) => v || null),
  visitId: z.string().optional().transform((v) => v || null),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Müşteri seç."),
  number: z.string().trim().min(1, "Fatura numarası gerekli.").max(40),
  status: requiredEnum(INVOICE_STATUSES),
  dueAt: optionalDateTime,
  taxCents: optionalMoneyCents,
  notes: optionalText(2000),
  lines: z.array(invoiceLineSchema).min(1, "En az bir satır gerekli."),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.coerce.number().int().min(1).max(10_000_000),
  method: requiredEnum(PAYMENT_METHODS),
  reference: optionalText(120),
  notes: optionalText(500),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
