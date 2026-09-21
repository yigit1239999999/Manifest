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
      // The phone is on the row because the row is a piece of work, and
      // the work is usually a call. Without it the "Call" action is a
      // detour through the client page to fetch one field, which is how a
      // list of things to do stops being used as one.
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          // Consent is why a row will never be sent, and without it the
          // list can only say "not sent yet" about an owner who said no.
          notificationsOptIn: true,
        },
      },
      pet: { select: { id: true, name: true, deceased: true, archivedAt: true } },
      // What actually happened to this reminder's message, which
      // `Reminder.status` cannot say: the status is the vet's decision,
      // these rows are the provider's answer. Bounded per reminder by
      // the sweep's own retry rule (one success, or at most three
      // failures), so this adds one query to the page, not one per row.
      messages: {
        where: { kind: "REMINDER_DUE" },
        orderBy: { createdAt: "desc" },
        // `body` and `recipient` are for the fold under the row: what
        // was written and where it went. They are not rendered in the
        // list itself, and a reminder carries at most one success or
        // three failures, so the rows do not grow with the clinic.
        select: {
          status: true,
          createdAt: true,
          error: true,
          channel: true,
          body: true,
          recipient: true,
        },
      },
    },
  });
}

export async function countOpenReminders(clinicId: string) {
  return prisma.reminder.count({
    where: { clinicId, status: { in: [...OPEN_REMINDER_STATUSES] as never } },
  });
}
