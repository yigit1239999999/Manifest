import { prisma } from "@/lib/prisma";
import { conflict, notFound, validationFailed } from "@/lib/errors";
import { withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { InvoiceInput, PaymentInput } from "./schema";

function lineTotals(lines: InvoiceInput["lines"]) {
  return lines.reduce(
    (acc, line) => acc + line.quantity * line.unitPriceCents,
    0,
  );
}

export async function createInvoice(input: InvoiceInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "invoices.write");
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

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Invoice",
      changes: { number: input.number, total },
    },
    (tx) =>
      tx.invoice.create({
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
      }),
  );
}

export async function recordPayment(input: PaymentInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "payments.write");

  // Tenant check before opening the (more expensive) serializable
  // transaction — keeps unauthorised lookups cheap.
  const guard = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, clinicId: ctx.clinicId },
    select: { id: true, totalCents: true, status: true },
  });
  if (!guard) throw notFound("Fatura", input.invoiceId);

  // Serializable ensures concurrent payments compute paidSoFar against
  // the post-insert truth, not a stale snapshot. Postgres will retry /
  // serialize, so the invoice status reflects the actual sum of payments.
  const payment = await prisma.$transaction(
    async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
        },
      });

      const sum = await tx.payment.aggregate({
        where: { invoiceId: input.invoiceId },
        _sum: { amountCents: true },
      });
      const paidSoFar = sum._sum.amountCents ?? 0;

      let newStatus = guard.status;
      if (paidSoFar >= guard.totalCents) newStatus = "PAID";
      else if (paidSoFar > 0) newStatus = "PARTIAL";

      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : null,
        },
      });

      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "UPDATE",
          entityType: "Invoice",
          entityId: input.invoiceId,
          changes: {
            paymentAmount: input.amountCents,
            paidSoFar,
            newStatus,
          },
        },
        tx,
      );

      return created;
    },
    { isolationLevel: "Serializable" },
  );

  return payment;
}

export async function voidInvoice(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "invoices.void");
  const existing = await prisma.invoice.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, clientId: true },
  });
  if (!existing) throw notFound("Fatura", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      changes: { status: "VOID" },
    },
    (tx) => tx.invoice.update({ where: { id }, data: { status: "VOID" } }),
  );
  return existing;
}
