import { prisma } from "@/lib/prisma";

export async function listReminders({
  clinicId,
  statuses = ["PENDING", "SENT"],
  take = 100,
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
