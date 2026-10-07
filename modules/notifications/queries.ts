import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { isPetSilenced } from "@/lib/pet-status";
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
  // Never set up, as distinct from switched off: the clinic has not
  // been here yet, and the sentence for it is an invitation rather
  // than a reminder of its own decision.
  "notSetUp",
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
 * Which question a row answers, named because both sides use the same
 * word: the dashboard counts `unreached` and links to
 * `?status=blocked&group=unreached`, which filters the tab to exactly
 * the rows behind that number (`d62cec3`). The name is what stops the
 * badge and the list describing different sets -- and it is a name
 * rather than a filter expression precisely so the link and the query
 * cannot drift apart.
 */
export type ReminderProblemGroup = "unreached" | "blocked";

export interface BlockedReminder {
  id: string;
  /** `ReminderType`: what a booking from this row is for. */
  type: string;
  title: string;
  dueAt: Date;
  reason: BlockedReminderReason;
  group: ReminderProblemGroup;
  /**
   * When it was tried, for the reasons that were tried at all.
   *
   * `null` for the blocked group, where nothing was attempted and a
   * date would be an invention. dev-ui had the choice between a made
   * up timestamp and a silent row and took the silent one, which was
   * right and could not stay: a silent row is the gap the tab exists
   * to close.
   */
  at: Date | null;
  /**
   * How many attempts the sweep has spent, for a failure it gave up
   * on. `null` where the question does not apply.
   *
   * The sweep's own count (`spentAttempts`), so the number a vet
   * reads and the number the sweep budgets are the same number.
   */
  attempts: number | null;
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
  client: { id: string; firstName: string; lastName: string | null; phone: string | null };
  /**
   * `silenced` when the animal has died or been archived. The reason
   * cannot say so on its own: a message already tried is reported
   * before the animal is looked at, so an animal that died after its
   * message went undelivered reads `undelivered`, and the row would
   * offer to book it.
   */
  pet: { id: string; name: string; silenced: boolean } | null;
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
  /**
   * Per reason, over everything found rather than the capped rows.
   *
   * The settings screen needs one of these on its own -- how many
   * messages are held up because nobody has asked those owners for
   * consent -- and it has to come from here rather than from a query
   * of its own, or the number beside the switch and the number on
   * the dashboard will one day disagree.
   */
  byReason: Record<BlockedReminderReason, number>;
}> {
  const clinic = await getClinicMessagingProfile(clinicId);
  const emptyByReason = () =>
    Object.fromEntries(
      [...BLOCKED_STATES, ...UNREACHED_STATES].map((r) => [r, 0]),
    ) as Record<BlockedReminderReason, number>;
  if (!clinic)
    return { items: [], total: 0, unreachedTotal: 0, blockedTotal: 0, byReason: emptyByReason() };

  const { from, to } = reminderNoticeWindow(now, clinic.notifications.whatsapp.reminders);
  const rows = await prisma.reminder.findMany({
    where: {
      clinicId,
      status: "PENDING",
      dueAt: { gte: from, lte: to },
      // An archived owner is not work. The sweep's own candidate
      // query excludes them, and a tab that lists them would send a
      // vet to tidy a record for somebody the clinic no longer sees.
      client: { archivedAt: null },
    },
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
      type: row.type,
      title: row.title,
      dueAt: row.dueAt,
      reason,
      group: (UNREACHED_STATES as readonly string[]).includes(reason)
        ? "unreached"
        : "blocked",
      at: "at" in state ? state.at : null,
      attempts: state.state === "failed" ? state.attempts : null,
      client: {
        id: row.client.id,
        firstName: row.client.firstName,
        lastName: row.client.lastName,
        phone: row.client.phone,
      },
      pet: row.pet
        ? { id: row.pet.id, name: row.pet.name, silenced: isPetSilenced(row.pet) }
        : null,
    });
  }

  const byReason = emptyByReason();
  for (const b of blocked) byReason[b.reason]++;

  return {
    items: blocked.slice(0, take),
    total: blocked.length,
    byReason,
    // Counted over everything found, not over the capped rows: a
    // badge that shrinks when the list is cut describes a different
    // set than the one it sits on.
    unreachedTotal: blocked.filter((b) => b.group === "unreached").length,
    blockedTotal: blocked.filter((b) => b.group === "blocked").length,
  };
}
