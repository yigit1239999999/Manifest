import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

export interface ListInvoicesArgs {
  clinicId: string;
  clientId?: string | null;
  statuses?: string[] | null;
  take?: number;
}

function buildInvoiceWhere(
  args: Omit<ListInvoicesArgs, "take">,
): Prisma.InvoiceWhereInput {
  return {
    clinicId: args.clinicId,
    // Cascade soft-delete: invoices for archived clients drop out.
    client: { archivedAt: null },
    ...(args.clientId ? { clientId: args.clientId } : {}),
    ...(args.statuses && args.statuses.length > 0
      ? { status: { in: args.statuses as never } }
      : {}),
  };
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

export async function listInvoicesPage({
  page = 1,
  perPage = PAGE_SIZES.DEFAULT,
  ...args
}: PagedInvoicesArgs) {
  const where = buildInvoiceWhere(args);
  const [items, total] = await Promise.all([
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
          visit: { select: { id: true, visitedAt: true, type: true } },
        },
      },
      payments: { orderBy: { paidAt: "desc" } },
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

export async function outstandingInvoicesCount(clinicId: string) {
  return prisma.invoice.count({
    where: {
      clinicId,
      client: { archivedAt: null },
      status: { in: ["SENT", "PARTIAL"] },
    },
  });
}

export async function outstandingInvoiceTotal(clinicId: string): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: {
      clinicId,
      client: { archivedAt: null },
      status: { in: ["SENT", "PARTIAL"] },
    },
    _sum: { totalCents: true },
  });
  return result._sum.totalCents ?? 0;
}
