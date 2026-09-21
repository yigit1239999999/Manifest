import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { reminderDeliveryState, reminderNoticeWindow } from "./service";
import { getClinicMessagingProfile } from "./settings";

export async function listMessagesForAppointment(clinicId: string, appointmentId: string) {
  return prisma.messageLog.findMany({
    where: { clinicId, appointmentId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, kind: true, status: true, channel: true, createdAt: true, error: true, language: true },
  });
}

/**
 * The reminders inside the sweep's horizon that will never be sent,
 * and why.
 *
 * One function, because two screens ask the same question: the
 * dashboard wants the number, the list's "will not be sent" tab wants
 * the rows. Written twice they would eventually disagree, and on that
 * day nobody could say which was right.
 *
 * It does not decide anything itself. The reason comes from
 * `reminderDeliveryState` -- the same call the row already makes, in
 * the same order, including the one that moved when sending by hand
 * started working with the clinic switch off. A second copy of that
 * ordering is the defect this is built to avoid, not a shortcut it
 * may take.
 *
 * Only the states where nothing WILL go count. A failed send, a held
 * back twin or a delivery already reported are things that happened,
 * and they have their own sentences on the row; this answers "what
 * is stuck", which is a different question from "what went wrong".
 */
const BLOCKED_STATES = [
  "optedOut",
  "neverAsked",
  "noPhone",
  "petSilenced",
  "notConfigured",
  "disabled",
] as const;

/**
 * Tried, and it did not arrive.
 *
 * A different group from the one above and the reason is what a vet
 * does about it: these end in picking up the phone today, where the
 * others end in tidying a record. The test that separates them is
 * whether the number can reach zero this week -- `optedOut` never
 * can, `neverAsked` erodes over months, and a number that cannot
 * reach zero stops being read.
 *
 * `failedExhausted` and not every failure: a reminder the sweep will
 * try again tonight is not work for this morning. Exhaustion is the
 * sweep's own count (`spentAttempts`), so our duplicate blocks do not
 * push a row into this group.
 */
const UNREACHED_STATES = ["undelivered", "failedExhausted"] as const;

export type BlockedReminderReason =
  | (typeof BLOCKED_STATES)[number]
  | (typeof UNREACHED_STATES)[number];

/**
 * Which question a row answers, named because both sides need the
 * same word: the dashboard counts `unreached`, and clicking that
 * count filters the tab to exactly those rows.
 */
export type ReminderProblemGroup = "unreached" | "blocked";

export interface BlockedReminder {
  id: string;
  title: string;
  dueAt: Date;
  reason: BlockedReminderReason;
  group: ReminderProblemGroup;
  /**
   * The number, raw, because four of the six reasons end in a phone
   * call -- and a list that shows a problem while sending the work to
   * another screen to act on it is a list that gets read once.
   *
   * Raw on purpose: whether it can be dialled, and what to render when
   * it cannot, is the screen's question and `telHref` is its answer.
   * Formatting it here would be the fourth copy of a rule that already
   * has one home.
   */
  client: { id: string; firstName: string; lastName: string; phone: string | null };
  pet: { id: string; name: string } | null;
}

/**
 * The window bounds the work, and that is deliberate: a count over
 * all time would report reminders that are not anybody's work yet,
 * and the number on a dashboard has to mean "today's problem". The
 * horizon comes from `reminderNoticeWindow`, the sweep's own, so the
 * two cannot drift.
 *
 * Every row in the window is read, because the reason is derived in
 * TypeScript and cannot be counted in SQL without writing the
 * ordering a second time. That is bounded by the window rather than
 * by the table -- the sweep already loads exactly this set every
 * fifteen minutes -- and `items` is capped while `total` is not, so
 * the number stays true when the list is cut.
 */
export async function blockedReminders(
  clinicId: string,
  { now = new Date(), take = PAGE_SIZES.LIST }: { now?: Date; take?: number } = {},
): Promise<{
  items: BlockedReminder[];
  total: number;
  /** Tried and did not arrive: the dashboard's number. */
  unreachedTotal: number;
  /** Never sent, and will not be: the tab's other half. */
  blockedTotal: number;
}> {
  const clinic = await getClinicMessagingProfile(clinicId);
  if (!clinic) return { items: [], total: 0, unreachedTotal: 0, blockedTotal: 0 };

  const { from, to } = reminderNoticeWindow(now, clinic.notifications.whatsapp.reminders);
  const rows = await prisma.reminder.findMany({
    where: { clinicId, status: "PENDING", dueAt: { gte: from, lte: to } },
    orderBy: { dueAt: "asc" },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, phone: true, notificationsOptIn: true },
      },
      pet: { select: { id: true, name: true, deceased: true, archivedAt: true } },
      messages: {
        where: { kind: "REMINDER_DUE" },
        select: { status: true, createdAt: true, error: true, channel: true },
      },
    },
  });

  const blocked: BlockedReminder[] = [];
  for (const row of rows) {
    const state = reminderDeliveryState(row, clinic);
    if (!state) continue;

    // A failure the sweep has given up on is work; one it will retry
    // tonight is not, and neither is anything it has not tried yet.
    const reason: BlockedReminderReason | null =
      state.state === "failed"
        ? state.exhausted
          ? "failedExhausted"
          : null
        : (BLOCKED_STATES as readonly string[]).includes(state.state) ||
            (UNREACHED_STATES as readonly string[]).includes(state.state)
          ? (state.state as BlockedReminderReason)
          : null;
    if (!reason) continue;

    blocked.push({
      id: row.id,
      title: row.title,
      dueAt: row.dueAt,
      reason,
      group: (UNREACHED_STATES as readonly string[]).includes(reason)
        ? "unreached"
        : "blocked",
      client: {
        id: row.client.id,
        firstName: row.client.firstName,
        lastName: row.client.lastName,
        phone: row.client.phone,
      },
      pet: row.pet ? { id: row.pet.id, name: row.pet.name } : null,
    });
  }

  return {
    items: blocked.slice(0, take),
    total: blocked.length,
    // Counted over everything found, not over the capped rows: a
    // badge that shrinks when the list is cut describes a different
    // set than the one it sits on.
    unreachedTotal: blocked.filter((b) => b.group === "unreached").length,
    blockedTotal: blocked.filter((b) => b.group === "blocked").length,
  };
}
