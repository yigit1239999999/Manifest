import { prisma } from "@/lib/prisma";
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
  take = 100,
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
  perPage = 25,
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
        },
      },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
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
