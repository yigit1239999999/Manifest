"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, type FormState } from "@/lib/action";
import { invoiceSchema, paymentSchema } from "./schema";
import { createInvoice, recordPayment, voidInvoice } from "./service";

// Invoices use a custom parse because lines come in as repeated form fields.
function parseInvoiceFormData(formData: FormData) {
  const raw = {
    clientId: String(formData.get("clientId") ?? ""),
    number: String(formData.get("number") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    dueAt: String(formData.get("dueAt") ?? ""),
    taxCents: String(formData.get("taxCents") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    lines: extractLines(formData),
  };
  return invoiceSchema.safeParse(raw);
}

function extractLines(formData: FormData) {
  const lines: unknown[] = [];
  for (let i = 0; ; i++) {
    const description = formData.get(`lines[${i}].description`);
    if (description == null) break;
    lines.push({
      description: String(description),
      quantity: String(formData.get(`lines[${i}].quantity`) ?? "1"),
      unitPriceCents: String(formData.get(`lines[${i}].unitPriceCents`) ?? "0"),
      petId: String(formData.get(`lines[${i}].petId`) ?? ""),
      visitId: String(formData.get(`lines[${i}].visitId`) ?? ""),
    });
  }
  return lines;
}

export const createInvoiceAction = action(
  "invoice.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parseInvoiceFormData(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as string | undefined) ?? "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { fieldErrors };
    }

    const invoice = await createInvoice(parsed.data, ctx);
    revalidatePath("/invoices");
    revalidatePath(`/clients/${invoice.clientId}`);
    revalidatePath("/");
    redirect(`/invoices/${invoice.id}`);
  },
);

export const recordPaymentAction = action(
  "invoice.record_payment",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = paymentSchema.safeParse({
      invoiceId: String(formData.get("invoiceId") ?? ""),
      amountCents: String(formData.get("amountCents") ?? ""),
      method: String(formData.get("method") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as string | undefined) ?? "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { fieldErrors };
    }

    await recordPayment(parsed.data, ctx);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${parsed.data.invoiceId}`);
    revalidatePath("/");
    return { success: true };
  },
);

export const voidInvoiceAction = action(
  "invoice.void",
  async (ctx, id: string): Promise<void> => {
    const { clientId } = await voidInvoice(id, ctx);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/");
  },
);
