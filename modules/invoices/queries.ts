import { prisma } from "@/lib/prisma";

export interface ListInvoicesArgs {
  clinicId: string;
  clientId?: string | null;
  statuses?: string[] | null;
  take?: number;
}

export async function listInvoices({
  clinicId,
  clientId,
  statuses,
  take = 100,
}: ListInvoicesArgs) {
  return prisma.invoice.findMany({
    where: {
      clinicId,
      ...(clientId ? { clientId } : {}),
      ...(statuses && statuses.length > 0
        ? { status: { in: statuses as never } }
        : {}),
    },
    orderBy: { issuedAt: "desc" },
    take,
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { lines: true, payments: true } },
    },
  });
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
    where: { clinicId, status: { in: ["SENT", "PARTIAL"] } },
  });
}

export async function outstandingInvoiceTotal(clinicId: string): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: { clinicId, status: { in: ["SENT", "PARTIAL"] } },
    _sum: { totalCents: true },
  });
  return result._sum.totalCents ?? 0;
}
