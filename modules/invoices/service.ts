import { prisma } from "@/lib/prisma";
import { conflict, notFound, validationFailed } from "@/lib/errors";
import { withAudited, writeAudit } from "@/lib/audit";
import { dayKey, formatMoney } from "@/lib/format";
import { requirePermission } from "@/lib/permissions";
import { msg } from "@/lib/forms";
import type { ActionContext } from "@/lib/action";
import type { Prisma } from "@/generated/prisma/client";
import { vatCents, type InvoiceInput, type PaymentInput } from "./schema";

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

  if (input.number) {
    const existing = await prisma.invoice.findFirst({
      where: { clinicId: ctx.clinicId, number: input.number },
      select: { id: true },
    });
    if (existing) throw conflict("error.conflict.invoiceDuplicate");
  }

  // Stamped now, not read later: the invoice keeps the currency it was
  // issued in even after the clinic changes its setting.
  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { currency: true, timezone: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);

  const subtotal = lineTotals(input.lines);
  // A rate, when the form sent one, is the source of truth and the amount
  // is worked out here: the screen's live total and the stored one are the
  // same arithmetic. A typed amount is still read for callers that send it.
  const taxRate = input.taxRate ?? null;
  const tax = taxRate !== null ? vatCents(subtotal, taxRate) : (input.tax ?? 0);
  const total = subtotal + tax;

  return prisma.$transaction(async (tx) => {
    const number = input.number ?? (await nextInvoiceNumber(tx, ctx.clinicId, clinic.timezone));
    const created = await tx.invoice.create({
      data: {
        clinicId: ctx.clinicId,
        clientId: input.clientId,
        number,
        currency: clinic.currency,
        status: input.status,
        dueAt: input.dueAt,
        notes: input.notes,
        subtotalCents: subtotal,
        taxCents: tax,
        taxRate,
        totalCents: total,
        lines: {
          create: input.lines.map((line) => ({
            description: line.description,
            kind: line.kind ?? null,
            quantity: line.quantity,
            unitPriceCents: line.unitPrice,
            totalCents: line.quantity * line.unitPrice,
            petId: line.petId,
            visitId: line.visitId,
          })),
        },
      },
      include: { lines: true },
    });
    await writeAudit(
      {
        clinicId: ctx.clinicId,
        actorId: ctx.userId,
        action: "CREATE",
        entityType: "Invoice",
        entityId: created.id,
        changes: { number, total, taxRate },
      },
      tx,
    );
    return created;
  });
}

/**
 * The clinic's next invoice number for this year: "2026-0001", then
 * "2026-0002", in the clinic's own calendar year.
 *
 * ONE atomic statement advances the counter, inside the invoice's own
 * transaction: the row lock it takes makes a second invoice saved at the
 * same moment wait and then take the next number, and a save that fails
 * rolls the number back with it -- no gaps from errors, no duplicates from
 * races. A number somebody once typed by hand that happens to read the
 * same is stepped over rather than collided with; existing numbers are
 * never changed.
 */
async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  clinicId: string,
  timeZone: string | null,
): Promise<string> {
  const year = Number(dayKey(new Date(), timeZone || undefined).slice(0, 4));
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await tx.$queryRaw<Array<{ last: number }>>`
      INSERT INTO "invoice_counters" ("clinicId", "year", "last")
      VALUES (${clinicId}, ${year}, 1)
      ON CONFLICT ("clinicId", "year")
      DO UPDATE SET "last" = "invoice_counters"."last" + 1
      RETURNING "last"`;
    const number = formatInvoiceNumber(year, Number(rows[0]?.last ?? 0));
    const taken = await tx.invoice.findFirst({
      where: { clinicId, number },
      select: { id: true },
    });
    if (!taken) return number;
  }
  throw conflict("error.conflict.invoiceDuplicate");
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * A serializable transaction, run again when Postgres could not order it
 * against a concurrent one (P2034).
 *
 * The retry is what turns a race into the right answer instead of an error
 * page: of two payments that each fit the balance on their own, the second
 * is re-run after the first has committed, sees the smaller balance, and is
 * refused with the amount that is actually left.
 */
async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code !== "P2034" || attempt >= 2) throw error;
    }
  }
}

/** The payments that count towards an invoice: every one not voided. */
async function paidCents(tx: Prisma.TransactionClient, invoiceId: string) {
  const sum = await tx.payment.aggregate({
    where: { invoiceId, voidedAt: null },
    _sum: { amountCents: true },
  });
  return sum._sum.amountCents ?? 0;
}

/**
 * `locale` is the one the amount was typed in. It is used only to word the
 * refusal: the remaining balance is told back in the invoice's own currency,
 * so the person sees at once which digit was one too many.
 */
export async function recordPayment(
  input: PaymentInput,
  ctx: ActionContext,
  locale: string,
) {
  requirePermission(ctx.userRole, "payments.write");

  // Tenant check before opening the (more expensive) serializable
  // transaction — keeps unauthorised lookups cheap.
  const guard = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!guard) throw notFound("invoice", input.invoiceId);

  // The balance is read inside the same serializable transaction as the
  // insert. Read before it, two payments taken at the same moment would
  // each see the whole balance and both be accepted.
  return serializable(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, clinicId: ctx.clinicId },
      select: { totalCents: true, currency: true, status: true },
    });
    if (!invoice) throw notFound("invoice", input.invoiceId);
    if (invoice.status === "VOID") throw conflict("error.conflict.invoiceVoided");

    const paidBefore = await paidCents(tx, input.invoiceId);
    const remaining = invoice.totalCents - paidBefore;
    // Refused, never trimmed to fit: "1,234.56" on a 222.22 invoice is a
    // typo, and quietly recording 222.22 instead would hide it a second time.
    if (input.amount > remaining) {
      throw validationFailed({
        amount: [
          remaining > 0
            ? msg("error.form.paymentOverBalance", {
                remaining: formatMoney(locale, remaining, invoice.currency),
              })
            : msg("error.form.paymentNothingOwed"),
        ],
      });
    }

    const created = await tx.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amountCents: input.amount,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
      },
    });

    const paidSoFar = paidBefore + input.amount;
    const newStatus = paidSoFar >= invoice.totalCents ? "PAID" : "PARTIAL";

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
          paymentId: created.id,
          paymentAmount: input.amount,
          paidSoFar,
          newStatus,
        },
      },
      tx,
    );

    return created;
  });
}

/**
 * Takes back a payment that was recorded by mistake.
 *
 * Voided, not deleted: the row stays, struck through on the invoice, with
 * who took it back and when, because "an amount was entered and then
 * withdrawn" is itself part of the invoice's history. The correction for a
 * wrong amount is to void it and record the right one.
 *
 * Gated by `payments.write`, the permission that recorded it: whoever can
 * make the mistake at the till is the person who notices it there, and
 * sending them to an administrator to fix a typo is how typos stay.
 *
 * The invoice's status is worked out again from the payments that still
 * count, in the same serializable transaction, for the reason
 * `recordPayment` reads its balance there. With nothing left paid it goes
 * back to SENT rather than to whatever it was before the first payment: an
 * invoice someone has paid against has been issued. A voided invoice keeps
 * its status; voiding a payment does not bring it back.
 *
 * Voiding twice is a no-op, not an error: two people correcting the same
 * mistake at once have both got what they asked for.
 */
export async function voidPayment(
  paymentId: string,
  ctx: ActionContext,
  reason?: string | null,
) {
  requirePermission(ctx.userRole, "payments.write");

  return serializable(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, invoice: { clinicId: ctx.clinicId } },
      select: {
        id: true,
        invoiceId: true,
        amountCents: true,
        voidedAt: true,
        invoice: { select: { totalCents: true, status: true, paidAt: true } },
      },
    });
    if (!payment) throw notFound("payment", paymentId);
    if (payment.voidedAt) return { invoiceId: payment.invoiceId };

    const voidReason = reason?.trim().slice(0, 500) || null;
    await tx.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: ctx.userId, voidReason },
    });

    const { invoice } = payment;
    const paidSoFar = await paidCents(tx, payment.invoiceId);
    let newStatus = invoice.status;
    let paidAt = invoice.paidAt;
    if (invoice.status !== "VOID") {
      if (paidSoFar >= invoice.totalCents) {
        newStatus = "PAID";
      } else {
        newStatus = paidSoFar > 0 ? "PARTIAL" : "SENT";
        paidAt = null;
      }
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: newStatus, paidAt },
      });
    }

    await writeAudit(
      {
        clinicId: ctx.clinicId,
        actorId: ctx.userId,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: payment.invoiceId,
        changes: {
          voidedPaymentId: paymentId,
          paymentAmount: payment.amountCents,
          voidReason,
          paidSoFar,
          previousStatus: invoice.status,
          newStatus,
        },
      },
      tx,
    );

    return { invoiceId: payment.invoiceId };
  });
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
/**
 * Moves a draft to sent. A draft saved by mistake used to have no way
 * forward: the page offered only "cancel" and "record payment", and it
 * never counted as owed (QA). Only from DRAFT, so it cannot undo a
 * payment's status or revive a void invoice.
 */
export async function markInvoiceSent(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "invoices.write");
  const existing = await prisma.invoice.findFirst({
    where: { id, clinicId: ctx.clinicId, status: "DRAFT" },
    select: { id: true },
  });
  if (!existing) throw notFound("invoice", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      changes: { status: "SENT" },
    },
    (tx) => tx.invoice.update({ where: { id }, data: { status: "SENT" } }),
  );
  return existing;
}

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
