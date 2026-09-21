import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";

/**
 * A reminder that still counts as work: created and waiting, or sent and
 * waiting for the animal to come back. The dashboard card and the list both
 * read this, because a card saying 3 that opens a list of 7 teaches the user
 * that neither number is worth reading.
 *
 * A sent reminder is not a finished one: nothing has been confirmed until
 * the animal is seen. That is why `SENT` is here and not in a "done" set.
 */
export const OPEN_REMINDER_STATUSES = ["PENDING", "SENT"] as const;

export async function listReminders({
  clinicId,
  statuses = [...OPEN_REMINDER_STATUSES],
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

export async function countOpenReminders(clinicId: string) {
  return prisma.reminder.count({
    where: { clinicId, status: { in: [...OPEN_REMINDER_STATUSES] as never } },
  });
}
