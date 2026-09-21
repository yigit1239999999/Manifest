import { prisma } from "@/lib/prisma";
import { conflict, notFound, validationFailed } from "@/lib/errors";
import { withAudited, writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { InvoiceInput, PaymentInput } from "./schema";

function lineTotals(lines: InvoiceInput["lines"]) {
  return lines.reduce(
    (acc, line) => acc + line.quantity * line.unitPrice,
    0,
  );
}

export async function createInvoice(input: InvoiceInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "invoices.write");
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!client) throw validationFailed({ clientId: ["error.validation.clientRequired"] });

  const existing = await prisma.invoice.findFirst({
    where: { clinicId: ctx.clinicId, number: input.number },
    select: { id: true },
  });
  if (existing) throw conflict("error.conflict.invoiceDuplicate");

  // Stamped now, not read later: the invoice keeps the currency it was
  // issued in even after the clinic changes its setting.
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { currency: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);

  const subtotal = lineTotals(input.lines);
  const tax = input.tax ?? 0;
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
          currency: clinic.currency,
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
              unitPriceCents: line.unitPrice,
              totalCents: line.quantity * line.unitPrice,
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
  if (!guard) throw notFound("invoice", input.invoiceId);

  // Serializable ensures concurrent payments compute paidSoFar against
  // the post-insert truth, not a stale snapshot. Postgres will retry /
  // serialize, so the invoice status reflects the actual sum of payments.
  const payment = await prisma.$transaction(
    async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amountCents: input.amount,
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
            paymentAmount: input.amount,
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

/**
 * Voiding is one-way, and that is the intended design, not an omission.
 *
 * There is no `unvoidInvoice` and there should not be one. A voided invoice
 * is an accounting record: the correction for a mistake is to issue a new
 * invoice, not to quietly make the wrong one valid again. This has the same
 * shape as the archive bug that backlog 39 fixed and is not the same class —
 * archiving was an irreversible act dressed in a reversible word, so the
 * user was wrong about what they had done. Voiding is irreversible and is
 * meant to be. What it owes the user is that its weight reads correctly
 * before the click (TEAM.md #25), not a way back afterwards. **39 is not a
 * precedent here.**
 *
 * `invoices.void` is also the only permission held by `ADMIN` alone, and
 * that too is a decision: `VETERINARIAN` and `RECEPTIONIST` both carry
 * `invoices.write`, because writing the line items is their work. Striking
 * out a document that has already been issued belongs to whoever owns the
 * books. In a single-vet clinic that vet is the administrator, so the limit
 * costs nothing; in a larger one it is exactly the separation intended.
 */
export async function voidInvoice(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "invoices.void");
  const existing = await prisma.invoice.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, clientId: true },
  });
  if (!existing) throw notFound("invoice", id);

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
