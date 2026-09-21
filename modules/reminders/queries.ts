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
  const reminders = await prisma.reminder.findMany({
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

  return withSuppressedPartners(clinicId, reminders);
}

/**
 * Names the message that went in place of one held back.
 *
 * The fold can say "this did not go, the same words did" from the
 * suppressed row alone. What it cannot say from that row is WHICH
 * piece of work sent them, and a vet looking at two reminders for one
 * animal wants exactly that.
 *
 * Matched on recipient and body, which is the same pair the sweep
 * decides suppression from. Deriving the link any other way would put
 * two mechanisms on one fact, and the day they disagree the row names
 * the wrong message.
 *
 * Only an unambiguous match is used, and that is the whole of the
 * correctness argument. dev-ui's objection was that matching produces
 * a guess: with three reminders composing one text, which one went?
 * The answer is that the dedupe permits exactly one to go, so within
 * the window there is exactly one accepted message carrying that text
 * -- and it knows its own reminder. Where that does not hold (history
 * from before the dedupe, a partner older than the window), there is
 * no single answer and the row says nothing rather than the nearest
 * thing. A row that declines to say is better than one that says
 * wrongly; this session removed several sentences for being the
 * second kind.
 *
 * One extra query for the page, and only when something was actually
 * suppressed: the pairs are collected first and asked for together,
 * rather than a lookup per row.
 */
async function withSuppressedPartners<
  T extends { messages: { status: string; recipient: string; body: string }[] },
>(clinicId: string, reminders: T[]) {
  const pairs = new Map<string, { recipient: string; body: string }>();
  for (const reminder of reminders)
    for (const message of reminder.messages)
      if (message.status === "SUPPRESSED")
        pairs.set(`${message.recipient}|${message.body}`, {
          recipient: message.recipient,
          body: message.body,
        });
  if (pairs.size === 0)
    return reminders.map((r) => ({
      ...r,
      messages: r.messages.map((m) => ({ ...m, sentInstead: null as SentInstead })),
    }));

  const accepted = await prisma.messageLog.findMany({
    where: {
      clinicId,
      status: { in: ["SENT", "MANUAL"] },
      OR: [...pairs.values()],
    },
    select: { recipient: true, body: true, reminder: { select: { id: true, title: true } } },
  });

  // Ambiguity is resolved by refusing to answer, not by picking one.
  const byPair = new Map<string, SentInstead | "ambiguous">();
  for (const row of accepted) {
    if (!row.reminder) continue;
    const key = `${row.recipient}|${row.body}`;
    byPair.set(key, byPair.has(key) ? "ambiguous" : row.reminder);
  }

  return reminders.map((r) => ({
    ...r,
    messages: r.messages.map((m) => {
      if (m.status !== "SUPPRESSED") return { ...m, sentInstead: null as SentInstead };
      const found = byPair.get(`${m.recipient}|${m.body}`);
      return { ...m, sentInstead: found && found !== "ambiguous" ? found : null };
    }),
  }));
}

/** The reminder whose message went in place of a suppressed one. */
export type SentInstead = { id: string; title: string } | null;

export async function countOpenReminders(clinicId: string) {
  return prisma.reminder.count({
    where: { clinicId, status: { in: [...OPEN_REMINDER_STATUSES] as never } },
  });
}
