import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { DUPLICATE_SUPPRESSION_WINDOW_MS } from "@/modules/notifications/service";

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
 * Bounded in both directions, and neither bound is an optimisation.
 *
 * Backwards, by the sweep's own suppression window. Unbounded, the match looked at the clinic's
 * whole history -- and a vaccination reminder is annual, so next year
 * the same owner and animal compose the same words again. The year
 * after that there would be two accepted messages carrying that text,
 * the answer would become ambiguous, and the row would fall silent
 * for good. Safe, and cumulative: the feature would go out by itself
 * and nothing anywhere would say why.
 *
 * The window comes from the same constant the sweep decides with,
 * because the guarantee that makes the match a fact is the dedupe's,
 * and a guarantee has a duration as well as a shape. Measured from
 * the oldest suppressed message rather than from now: a message held
 * back twenty hours ago had a partner up to a window before THAT.
 *
 * Forwards, by the suppressed message itself: a message is only ever
 * held back BECAUSE another had already gone, so its partner cannot
 * be newer than it is. Without that the query would match forward in
 * time, and a row could say "the same message had already gone out"
 * while pointing at one sent an hour later. pm found exactly that in
 * the fixture data before measuring anything -- the direction is as
 * much a part of the guarantee as the window, and the same rule
 * applies: where the guarantee ends, the answer goes quiet.
 *
 * One extra query for the page, and only when something was actually
 * suppressed: the pairs are collected first and asked for together,
 * rather than a lookup per row. The query carries the coarse bounds
 * and each message checks its own, because one `where` cannot hold a
 * different upper bound per row.
 */
async function withSuppressedPartners<
  T extends { messages: { status: string; recipient: string; body: string; createdAt: Date }[] },
>(clinicId: string, reminders: T[]) {
  const pairs = new Map<string, { recipient: string; body: string }>();
  let oldestSuppressed: Date | null = null;
  let newestSuppressed: Date | null = null;
  for (const reminder of reminders)
    for (const message of reminder.messages)
      if (message.status === "SUPPRESSED") {
        pairs.set(`${message.recipient}|${message.body}`, {
          recipient: message.recipient,
          body: message.body,
        });
        if (!oldestSuppressed || message.createdAt < oldestSuppressed)
          oldestSuppressed = message.createdAt;
        if (!newestSuppressed || message.createdAt > newestSuppressed)
          newestSuppressed = message.createdAt;
      }
  if (pairs.size === 0)
    return reminders.map((r) => ({
      ...r,
      messages: r.messages.map((m) => ({ ...m, sentInstead: null as SentInstead })),
    }));

  const accepted = await prisma.messageLog.findMany({
    where: {
      clinicId,
      status: { in: ["SENT", "MANUAL"] },
      createdAt: {
        gte: new Date(oldestSuppressed!.getTime() - DUPLICATE_SUPPRESSION_WINDOW_MS),
        lte: newestSuppressed!,
      },
      OR: [...pairs.values()],
    },
    select: {
      recipient: true,
      body: true,
      createdAt: true,
      reminder: { select: { id: true, title: true } },
    },
  });

  const candidates = new Map<string, { at: Date; reminder: { id: string; title: string } }[]>();
  for (const row of accepted) {
    if (!row.reminder) continue;
    const key = `${row.recipient}|${row.body}`;
    candidates.set(key, [
      ...(candidates.get(key) ?? []),
      { at: row.createdAt, reminder: row.reminder },
    ]);
  }

  return reminders.map((r) => ({
    ...r,
    messages: r.messages.map((m) => {
      if (m.status !== "SUPPRESSED") return { ...m, sentInstead: null as SentInstead };
      // Its own upper bound: only a message that had already gone can
      // be the reason this one did not.
      const earlier = (candidates.get(`${m.recipient}|${m.body}`) ?? []).filter(
        (c) => c.at <= m.createdAt,
      );
      // Ambiguity is resolved by refusing to answer, not by picking one.
      return { ...m, sentInstead: earlier.length === 1 ? earlier[0].reminder : null };
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
