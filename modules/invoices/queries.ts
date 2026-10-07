import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { Prisma } from "@/generated/prisma/client";
import { fold } from "@/lib/search";

export interface ListInvoicesArgs {
  clinicId: string;
  clientId?: string | null;
  statuses?: string[] | null;
  /** Issued on or after, and before: instants of the clinic's days. */
  from?: Date | null;
  to?: Date | null;
  /** A client's name or phone, folded like every other search. */
  q?: string | null;
  take?: number;
}

export function buildInvoiceWhere(
  args: Omit<ListInvoicesArgs, "take">,
): Prisma.InvoiceWhereInput {
  const term = args.q?.trim();
  return {
    clinicId: args.clinicId,
    // Cascade soft-delete: invoices for archived clients drop out. The
    // client search rides on the same relation filter, through the
    // client's folded `searchKey` (trigram-indexed), so "ayse" finds Ayşe.
    client: { archivedAt: null, ...(term ? { searchKey: { contains: fold(term) } } : {}) },
    ...(args.clientId ? { clientId: args.clientId } : {}),
    ...(args.statuses && args.statuses.length > 0
      ? { status: { in: args.statuses as never } }
      : {}),
    // `invoices_clinicId_issuedAt_idx` serves the range.
    ...(args.from || args.to
      ? {
          issuedAt: {
            ...(args.from ? { gte: args.from } : {}),
            ...(args.to ? { lt: args.to } : {}),
          },
        }
      : {}),
  };
}

export type InvoiceTotals = Array<{
  currency: string;
  /** What was billed: every issued invoice in the filter, drafts and voids aside. */
  issuedCents: number;
  /** What has been paid on those invoices, voided payments aside. */
  collectedCents: number;
  /** What is still owed on the ones not settled (SENT, PARTIAL). */
  remainingCents: number;
}>;

/**
 * "Kesilen / tahsil edilen / kalan" for exactly the invoices the list is
 * showing (B10), every page of them, not the twenty on screen.
 *
 * Summed in the database with the list's own `where`, so the totals and
 * the rows cannot disagree about which invoices count. Per currency: an
 * invoice keeps the one it was issued in, and lira plus euros is not a
 * number. Two queries plus two per currency -- one in practice.
 */
export async function invoiceTotals(args: Omit<ListInvoicesArgs, "take">): Promise<InvoiceTotals> {
  const where = buildInvoiceWhere(args);
  const issuedWhere: Prisma.InvoiceWhereInput = { AND: [where, { status: { notIn: ["DRAFT", "VOID"] } }] };
  const openWhere: Prisma.InvoiceWhereInput = { AND: [where, { status: { in: ["SENT", "PARTIAL"] } }] };
  const [issued, open] = await Promise.all([
    prisma.invoice.groupBy({ by: ["currency"], where: issuedWhere, _sum: { totalCents: true } }),
    prisma.invoice.groupBy({ by: ["currency"], where: openWhere, _sum: { totalCents: true } }),
  ]);
  return Promise.all(
    issued.map(async (row) => {
      const [collected, paidOnOpen] = await Promise.all([
        prisma.payment.aggregate({
          where: { voidedAt: null, invoice: { AND: [issuedWhere, { currency: row.currency }] } },
          _sum: { amountCents: true },
        }),
        prisma.payment.aggregate({
          where: { voidedAt: null, invoice: { AND: [openWhere, { currency: row.currency }] } },
          _sum: { amountCents: true },
        }),
      ]);
      const openTotal = open.find((o) => o.currency === row.currency)?._sum.totalCents ?? 0;
      return {
        currency: row.currency,
        issuedCents: row._sum.totalCents ?? 0,
        collectedCents: collected._sum.amountCents ?? 0,
        remainingCents: Math.max(0, openTotal - (paidOnOpen._sum.amountCents ?? 0)),
      };
    }),
  );
}

export type CashByMethod = Array<{ currency: string; method: string; cents: number; count: number }>;

/**
 * The till, for month-end (job #16): money actually TAKEN between two
 * instants, by method -- cash, card, transfer -- whichever invoice it was
 * taken against. By the payment's own date, not the invoice's: a March
 * invoice paid in April is April's cash.
 */
export async function cashByMethod(clinicId: string, from: Date | null, to: Date | null): Promise<CashByMethod> {
  const rows = await prisma.$queryRaw<Array<{ currency: string; method: string; cents: number; count: number }>>(
    Prisma.sql`
      SELECT i.currency, p.method::text AS method,
        COALESCE(SUM(p."amountCents"), 0)::int AS cents, COUNT(*)::int AS count
      FROM "payments" p
      JOIN "invoices" i ON i.id = p."invoiceId"
      WHERE i."clinicId" = ${clinicId}
        AND p."voidedAt" IS NULL
        AND i.status <> 'VOID'
        ${from ? Prisma.sql`AND p."paidAt" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND p."paidAt" < ${to}` : Prisma.empty}
      GROUP BY i.currency, p.method
      ORDER BY i.currency, cents DESC
    `,
  );
  return rows;
}

/** Every invoice in the filter, for the accountant's export. Unpaged on purpose. */
export async function invoicesForExport(args: Omit<ListInvoicesArgs, "take">) {
  const rows = await prisma.invoice.findMany({
    where: buildInvoiceWhere(args),
    orderBy: { issuedAt: "asc" },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      status: true,
      currency: true,
      subtotalCents: true,
      taxRate: true,
      taxCents: true,
      totalCents: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
  return withRemaining(rows);
}

/** Every payment taken in a period, for the accountant's export. */
export async function paymentsForExport(clinicId: string, from: Date | null, to: Date | null) {
  return prisma.payment.findMany({
    where: {
      voidedAt: null,
      invoice: { clinicId, status: { not: "VOID" } },
      ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    },
    orderBy: { paidAt: "asc" },
    select: {
      paidAt: true,
      method: true,
      amountCents: true,
      reference: true,
      invoice: {
        select: { number: true, currency: true, client: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}

export async function listInvoices({
  take = PAGE_SIZES.LIST,
  ...args
}: ListInvoicesArgs) {
  return prisma.invoice.findMany({
    where: buildInvoiceWhere(args),
    orderBy: { issuedAt: "desc" },
    take,
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { lines: true, payments: true } },
    },
  });
}

export interface PagedInvoicesArgs extends Omit<ListInvoicesArgs, "take"> {
  page?: number;
  perPage?: number;
}

/**
 * What is still owed on each of these invoices: the total less every
 * payment that has not been voided, floored at zero the way the invoice
 * page floors it. Null for a voided invoice, which owes nothing, and
 * where a zero would read as "settled".
 *
 * ONE extra query for the page, not one per row: a `groupBy` over the
 * ids just fetched, summed in the database and served by
 * `payments_invoiceId_idx`. Scoped by those ids alone because a payment
 * has no clinic of its own; the ids came from a clinic-scoped query.
 */
async function withRemaining<
  T extends { id: string; status: string; totalCents: number },
>(invoices: T[]): Promise<(T & { remainingCents: number | null })[]> {
  if (invoices.length === 0) return [];
  const sums = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invoices.map((i) => i.id) }, voidedAt: null },
    _sum: { amountCents: true },
  });
  const paid = new Map(sums.map((s) => [s.invoiceId, s._sum.amountCents ?? 0]));
  return invoices.map((inv) => ({
    ...inv,
    // Owed only once it has been sent. A draft is not a debt yet and a
    // void one never will be ("-"); an invoice marked paid owes nothing,
    // even when it was marked paid in the form rather than through a
    // recorded payment (QA found "Ödendi" beside "Kalan ₺150").
    remainingCents:
      inv.status === "VOID" || inv.status === "DRAFT"
        ? null
        : inv.status === "PAID"
          ? 0
          : Math.max(0, inv.totalCents - (paid.get(inv.id) ?? 0)),
  }));
}

export async function listInvoicesPage({
  page = 1,
  perPage = PAGE_SIZES.DEFAULT,
  ...args
}: PagedInvoicesArgs) {
  const where = buildInvoiceWhere(args);
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true, payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);
  const items = await withRemaining(rows);
  return { items, total, page, perPage };
}

export async function getInvoiceById(clinicId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, clinicId },
    include: {
      client: true,
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          pet: { select: { id: true, name: true } },
          // The other half of ux's condition: an invoice says which
          // visit it came from, not only a visit which invoice it went
          // to. Without it `visitId` is a column that is filled and
          // never shown, which is indistinguishable from not having it.
          //
          // On the line and not on the invoice, because that is where
          // a visit is named: an invoice can gather several visits, and
          // a single link in the header would have to pick one of them
          // and be wrong about the rest.
          visit: {
            select: {
              id: true,
              visitedAt: true,
              type: true,
              // For the printed copy: the vet who saw the animal.
              vet: { select: { name: true, role: true } },
            },
          },
        },
      },
      // Voided payments too: they stay on the invoice, struck through,
      // so the page says who took one back. Sums filter on `voidedAt`.
      payments: {
        orderBy: { paidAt: "desc" },
        include: { voidedBy: { select: { name: true } } },
      },
    },
  });
}

/**
 * The invoice already raised for this visit, if there is one.
 *
 * Asked before offering to raise one. A visit billed twice is not a
 * display problem -- it is two demands for the same money, and the
 * clinic finds out when the client does. So the action on the visit
 * page either offers to bill or points at the bill, and this is the
 * question that decides which.
 *
 * Found through the line rather than the invoice, because that is
 * where a visit is recorded: an invoice can gather several visits, and
 * nothing on the invoice itself names one. `invoice_lines.visitId` got
 * an index for this (20260921210000); it had none, so this was a
 * sequential scan over every line in the database on a page opened all
 * day.
 *
 * Scoped by clinic on the invoice, not the line -- a line has no
 * clinic of its own and reaches one only through its invoice.
 */
export async function getInvoiceForVisit(clinicId: string, visitId: string) {
  const line = await prisma.invoiceLine.findFirst({
    where: { visitId, invoice: { clinicId } },
    orderBy: { createdAt: "asc" },
    select: {
      invoice: {
        select: { id: true, number: true, status: true, totalCents: true, currency: true },
      },
    },
  });
  return line?.invoice ?? null;
}

export type ClientBalance = {
  /** What is still owed, per currency the invoices were issued in. */
  owed: Array<{ currency: string; cents: number }>;
  /** How many issued invoices still have something left to pay. */
  invoiceCount: number;
};

/**
 * What one owner still owes: every issued invoice (`SENT`, `PARTIAL`) less
 * the payments on it that were not voided -- the same rule as the list's
 * "remaining" column and the dashboard's outstanding figure, so the three
 * never disagree about one person.
 *
 * Two queries whatever the owner's history: their open invoices, then one
 * `groupBy` over those ids. An owner with years of paid invoices costs the
 * same as one with none, because only the open ones are read.
 *
 * Per currency rather than one sum: an invoice keeps the currency it was
 * issued in, and adding lira to euros is a number that means nothing.
 */
export async function clientBalance(clinicId: string, clientId: string): Promise<ClientBalance> {
  const open = await prisma.invoice.findMany({
    where: { clinicId, clientId, status: { in: ["SENT", "PARTIAL"] } },
    select: { id: true, totalCents: true, currency: true },
  });
  if (open.length === 0) return { owed: [], invoiceCount: 0 };
  const sums = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: open.map((i) => i.id) }, voidedAt: null },
    _sum: { amountCents: true },
  });
  const paid = new Map(sums.map((s) => [s.invoiceId, s._sum.amountCents ?? 0]));
  const byCurrency = new Map<string, number>();
  let invoiceCount = 0;
  for (const inv of open) {
    const left = Math.max(0, inv.totalCents - (paid.get(inv.id) ?? 0));
    if (left === 0) continue;
    invoiceCount += 1;
    byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + left);
  }
  return {
    owed: [...byCurrency].map(([currency, cents]) => ({ currency, cents })),
    invoiceCount,
  };
}

/**
 * The VAT rate this clinic used on its most recent invoice, for the next
 * one to open on. A clinic that bills at 10% should not have to change
 * 20% on every invoice, and there is no settings screen to ask it on:
 * the last choice is the clinic's own answer. Null before the first.
 * One index read (`invoices_clinicId_issuedAt_idx`).
 */
export async function lastVatRate(clinicId: string): Promise<number | null> {
  const last = await prisma.invoice.findFirst({
    where: { clinicId, taxRate: { not: null } },
    orderBy: { issuedAt: "desc" },
    select: { taxRate: true },
  });
  return last?.taxRate ?? null;
}
