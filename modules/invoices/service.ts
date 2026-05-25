import { prisma } from "@/lib/prisma";
import { conflict, notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { ActionContext } from "@/lib/action";
import type { InvoiceInput, PaymentInput } from "./schema";

function lineTotals(lines: InvoiceInput["lines"]) {
  return lines.reduce(
    (acc, line) => acc + line.quantity * line.unitPriceCents,
    0,
  );
}

export async function createInvoice(input: InvoiceInput, ctx: ActionContext) {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!client) throw validationFailed({ clientId: ["Müşteri bulunamadı."] });

  const existing = await prisma.invoice.findFirst({
    where: { clinicId: ctx.clinicId, number: input.number },
    select: { id: true },
  });
  if (existing) throw conflict("Bu fatura numarası kullanılıyor.");

  const subtotal = lineTotals(input.lines);
  const tax = input.taxCents ?? 0;
  const total = subtotal + tax;

  const invoice = await prisma.invoice.create({
    data: {
      clinicId: ctx.clinicId,
      clientId: input.clientId,
      number: input.number,
      status: input.status,
      dueAt: input.dueAt,
      notes: input.notes,
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: total,
      lines: {
        create: input.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.quantity * line.unitPriceCents,
          petId: line.petId,
          visitId: line.visitId,
        })),
      },
    },
    include: { lines: true },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Invoice",
    entityId: invoice.id,
    changes: { number: invoice.number, total: invoice.totalCents },
  });
  return invoice;
}

export async function recordPayment(input: PaymentInput, ctx: ActionContext) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, clinicId: ctx.clinicId },
    include: { payments: true },
  });
  if (!invoice) throw notFound("Fatura", input.invoiceId);

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
    },
  });

  const paidSoFar =
    invoice.payments.reduce((acc, p) => acc + p.amountCents, 0) +
    input.amountCents;
  let newStatus = invoice.status;
  if (paidSoFar >= invoice.totalCents) newStatus = "PAID";
  else if (paidSoFar > 0) newStatus = "PARTIAL";

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: newStatus,
      paidAt: newStatus === "PAID" ? new Date() : null,
    },
  });

  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Invoice",
    entityId: invoice.id,
    changes: { paymentAmount: input.amountCents, newStatus },
  });
  return payment;
}

export async function voidInvoice(id: string, ctx: ActionContext) {
  const existing = await prisma.invoice.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, clientId: true },
  });
  if (!existing) throw notFound("Fatura", id);

  await prisma.invoice.update({
    where: { id },
    data: { status: "VOID" },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Invoice",
    entityId: id,
    changes: { status: "VOID" },
  });
  return existing;
}
