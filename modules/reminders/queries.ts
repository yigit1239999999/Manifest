import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";

export async function listReminders({
  clinicId,
  statuses = ["PENDING", "SENT"],
  take = PAGE_SIZES.LIST,
}: {
  clinicId: string;
  statuses?: string[];
  take?: number;
}) {
  return prisma.reminder.findMany({
    where: {
      clinicId,
      status: { in: statuses as never },
    },
    orderBy: { dueAt: "asc" },
    take,
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      pet: { select: { id: true, name: true } },
    },
  });
}

export async function countPendingReminders(clinicId: string) {
  return prisma.reminder.count({
    where: { clinicId, status: "PENDING" },
  });
}
