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

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Billed and not yet settled: the set behind "who has not paid?".
 *
 * The dashboard's outstanding figure counts the same two statuses
 * (`modules/dashboard/queries.ts`), so the tile and the list it opens
 * agree on what is owed. A draft has not been asked for yet, and a
 * voided invoice is no longer owed at all.
 */
export const UNPAID_INVOICE_STATUSES = ["SENT", "PARTIAL"] as const satisfies readonly InvoiceStatus[];

/** The list's `?status=` value for {@link UNPAID_INVOICE_STATUSES}. */
export const UNPAID_FILTER = "unpaid";

/**
 * The statuses a list `?status=` value stands for, or null for "all".
 *
 * Unknown values read as no filter rather than reaching the database:
 * the column is an enum, and an old or mistyped link would otherwise be
 * an error page instead of a list.
 */
export function invoiceStatusesForFilter(
  filter: string | null | undefined,
): InvoiceStatus[] | null {
  if (filter === UNPAID_FILTER) return [...UNPAID_INVOICE_STATUSES];
  if (filter && (INVOICE_STATUSES as readonly string[]).includes(filter)) {
    return [filter as InvoiceStatus];
  }
  return null;
}

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
export const INVOICE_LINE_KINDS = [
  "VISIT",
  "VACCINATION",
  "TREATMENT",
  "DIAGNOSTIC",
  "PRESCRIPTION",
] as const;

/**
 * VAT rates a Turkish invoice is written at, in percent. A select rather
 * than a typed amount: the vet knows the rate, and the amount is
 * arithmetic the screen should do (B9).
 */
export const VAT_RATES = [0, 1, 10, 20] as const;
export type VatRate = (typeof VAT_RATES)[number];

/** The rate a new invoice opens on when the clinic has not used one yet. */
export const DEFAULT_VAT_RATE: VatRate = 20;

/** Tax on a subtotal at a rate, rounded to the kuruş. */
export function vatCents(subtotalCents: number, rate: number): number {
  return Math.round((subtotalCents * rate) / 100);
}

const invoiceLineSchema = (locale: string) =>
  z.object({
    description: requiredText(1, 200, "invoice.description"),
    quantity: z.coerce.number().int().min(1).max(10_000),
    unitPrice: requiredMoney(locale, { maxCents: 10_000_000 }),
    petId: z.string().optional().transform((v) => v || null),
    visitId: z.string().optional().transform((v) => v || null),
    kind: z
      .string()
      .optional()
      .transform((v) =>
        v && (INVOICE_LINE_KINDS as readonly string[]).includes(v)
          ? (v as (typeof INVOICE_LINE_KINDS)[number])
          : null,
      ),
  });

export const invoiceSchema = (locale: string) =>
  z.object({
    clientId: requiredId("error.entity.client"),
    /**
     * Optional since numbering is sequential (B9): absent, the server gives
     * the clinic's next number when it saves. Present only for a number
     * typed on purpose, which is checked against the clinic's others.
     */
    number: optionalText(40),
    status: requiredEnum(INVOICE_STATUSES),
    dueAt: optionalDateTime,
    /** A typed tax amount, for callers that still send one. */
    tax: optionalMoney(locale),
    /** The VAT rate; the server works the amount out from the lines. */
    taxRate: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : Number(v)))
      .refine((v) => v === null || (VAT_RATES as readonly number[]).includes(v), msg("error.form.invalidChoice")),
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
