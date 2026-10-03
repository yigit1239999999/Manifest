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

/**
 * One page of reminders, and how many there are in all.
 *
 * Paged rather than capped. This used to be `take: 100` with no total and
 * no pager on the screen, so the 101st reminder simply was not there and
 * nothing said so (backlog 38) -- invisible on today's data, and certain
 * to bite the first clinic whose automatic reminders reach three digits,
 * which is the moment the list starts being useful. The page size stays
 * at 100 so a clinic under that sees exactly what it saw before.
 */
export async function listReminders({
  clinicId,
  statuses = [...OPEN_REMINDER_STATUSES],
  page = 1,
  perPage = PAGE_SIZES.LIST,
}: {
  clinicId: string;
  statuses?: string[];
  page?: number;
  perPage?: number;
}) {
  const where = { clinicId, status: { in: statuses as never } };
  const [items, total] = await Promise.all([
    findReminderRows(where, page, perPage),
    prisma.reminder.count({ where }),
  ]);
  return { items, total, page, perPage };
}

/**
 * How many reminders each tab of the list holds, from one grouped count.
 *
 * The tabs carry numbers because a list the vet checks against their own
 * notebook has to be countable: "Open 12 · Closed 84" says where the other
 * rows went, where a bare "Closed" only says there is somewhere they
 * might be (TEAM.md #16c). Open is the same constant the dashboard card
 * counts, so the card's number and the tab's cannot drift apart.
 */
export async function reminderStatusCounts(clinicId: string) {
  const groups = await prisma.reminder.groupBy({
    by: ["status"],
    where: { clinicId },
    _count: { _all: true },
  });
  let open = 0;
  let closed = 0;
  for (const g of groups) {
    if ((OPEN_REMINDER_STATUSES as readonly string[]).includes(g.status))
      open += g._count._all;
    else closed += g._count._all;
  }
  return { open, closed, all: open + closed };
}

function findReminderRows(
  where: { clinicId: string; status: { in: never } },
  page: number,
  perPage: number,
) {
  return prisma.reminder.findMany({
    where,
    orderBy: { dueAt: "asc" },
    skip: (page - 1) * perPage,
    take: perPage,
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
          // Delivery is a second question from sending, and the row's
          // sentence turns on it: accepted by the operator is not the
          // same as arrived, and "we have not heard yet" is not the
          // same as "it did not arrive".
          deliveryStatus: true,
          deliveredAt: true,
          // Read only in the fold, like `body`: the provider's own
          // vocabulary, useful for tracing and never a sentence.
          deliveryCode: true,
        },
      },
    },
  });
}
