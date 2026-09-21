import { Prisma, type MessageDeliveryStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import {
  toMessageLocale,
  visitTypeLabel,
  whatsappLink,
  type AppointmentMessageKind,
} from "@/lib/whatsapp/messages";
import { normalizePhone } from "@/lib/phone";
import { isPetSilenced } from "@/lib/pet-status";
import { isReminderDue, isReminderNoticeDue, reminderNoticeDueAt } from "@/lib/whatsapp/schedule";
import { composeAppointmentFor, composeReminderFor } from "@/lib/messaging/compose";
import {
  getTransport,
  isChannelConfigured,
  transportReportsDelivery,
} from "@/lib/messaging/transports";
import { failureScope } from "@/lib/messaging/failures";
import { TransportError, type Channel, type FailureScope } from "@/lib/messaging/types";
import { smsSegments } from "@/lib/messaging/sms/segments";
import { TIMEZONES, type NotificationSettingsInput } from "./schema";
import {
  countryCallingCode,
  getClinicMessagingProfile,
  parseNotificationSettings,
  toMessagingProfile,
  type ClinicMessagingProfile,
} from "./settings";

/** A failed automatic send is retried on later sweeps, up to this many times. */
export const MAX_AUTOMATIC_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function setNotificationSettings(
  input: NotificationSettingsInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "settings.manage");
  if (!(TIMEZONES as readonly string[]).includes(input.timezone))
    throw validationFailed({ timezone: ["error.validation.timezoneUnknown"] });

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: { settings: true },
  });
  if (!clinic) throw notFound("clinic", ctx.clinicId);
  const current =
    clinic.settings && typeof clinic.settings === "object" && !Array.isArray(clinic.settings)
      ? (clinic.settings as Record<string, unknown>)
      : {};
  const previous = parseNotificationSettings(current.notifications);

  const notifications = {
    channel: input.channel,
    whatsapp: {
      enabled: input.enabled,
      confirmOnBooking: input.confirmOnBooking,
      reminder: {
        mode: input.reminderMode,
        hoursBefore: input.hoursBefore ?? previous.whatsapp.reminder.hoursBefore,
        morningHour: input.morningHour ?? previous.whatsapp.reminder.morningHour,
      },
      reminders: {
        enabled: input.remindersEnabled,
        daysBefore: input.remindersDaysBefore ?? previous.whatsapp.reminders.daysBefore,
      },
    },
  };

  await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data: { timezone: input.timezone, settings: { ...current, notifications } },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Clinic",
    entityId: ctx.clinicId,
    changes: { notifications, timezone: input.timezone },
  });
  return notifications;
}

// ---------------------------------------------------------------------------
// Composing
// ---------------------------------------------------------------------------

const CLIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  preferredLanguage: true,
  notificationsOptIn: true,
} as const;

const APPOINTMENT_INCLUDE = {
  pet: { select: { name: true, deceased: true, archivedAt: true } },
  client: { select: CLIENT_SELECT },
  vet: { select: { name: true } },
} as const;

type LoadedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

async function loadAppointment(clinicId: string, id: string) {
  return prisma.appointment.findFirst({
    where: { id, clinicId },
    include: APPOINTMENT_INCLUDE,
  });
}

/**
 * Statuses after which an appointment's confirmation and reminder are no
 * longer true: it was cancelled, the client did not come, or the visit is
 * already over. "Randevunuz oluşturulmuştur" for any of these is a wrong
 * message, and a wrong message costs more trust than a missing one.
 */
export const CLOSED_APPOINTMENT_STATUSES = [
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
] as const;

export function isAppointmentClosed(status: string): boolean {
  return (CLOSED_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * The other half of the same rule, and the hole the status list left.
 *
 * Every past appointment in the measurement baseline is still `SCHEDULED`:
 * nobody goes back to mark last Tuesday as completed or missed, and there
 * is no reason they should. So a status check alone still let staff send
 * "your appointment has been booked" for an appointment that happened a
 * week ago — one click, no warning, and the message is simply false.
 *
 * The cut is the start time, not the end: once it has begun, the owner
 * either is in the waiting room or is not, and neither the confirmation
 * nor the reminder tells them anything true.
 */
export function isAppointmentPast(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() <= now.getTime();
}

/** No message about this appointment is true any more, for either reason. */
export function appointmentMessagingClosed(
  appointment: { status: string; startsAt: Date },
  now: Date = new Date(),
): boolean {
  return (
    isAppointmentClosed(appointment.status) ||
    isAppointmentPast(appointment.startsAt, now)
  );
}

export interface ComposedMessage {
  channel: Channel;
  kind: AppointmentMessageKind;
  language: "tr" | "en";
  recipient: string | null;
  body: string;
  /** Click-to-chat deep link (WhatsApp wording), for manual sending. */
  whatsappLink: string | null;
  /** Segment estimate for SMS bodies, for cost transparency in the UI. */
  segments: number | null;
}

export function composeFor(
  appointment: LoadedAppointment,
  kind: AppointmentMessageKind,
  clinic: ClinicMessagingProfile,
  channel: Channel = clinic.notifications.channel,
  now?: Date,
): ComposedMessage {
  const language = toMessageLocale(appointment.client.preferredLanguage);
  const recipient = normalizePhone(appointment.client.phone, countryCallingCode(clinic.country));
  const messageCtx = {
    locale: language,
    clientName: `${appointment.client.firstName} ${appointment.client.lastName}`.trim(),
    petName: appointment.pet.name,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    visitType: visitTypeLabel(appointment.type, language),
    vetName: appointment.vet?.name,
    clinic,
    now,
  };
  const body = composeAppointmentFor(channel, kind, messageCtx);
  const waBody = channel === "WHATSAPP" ? body : composeAppointmentFor("WHATSAPP", kind, messageCtx);
  return {
    channel,
    kind,
    language,
    recipient,
    body,
    whatsappLink: recipient ? whatsappLink(recipient, waBody) : null,
    segments: channel === "SMS" ? smsSegments(body).segments : null,
  };
}

/** Everything the appointment page needs to show and send messages. */
export async function previewAppointmentMessages(clinicId: string, appointmentId: string) {
  const [appointment, clinic] = await Promise.all([
    loadAppointment(clinicId, appointmentId),
    getClinicMessagingProfile(clinicId),
  ]);
  if (!appointment || !clinic) return null;
  const channel = clinic.notifications.channel;
  return {
    channel,
    configured: isChannelConfigured(channel),
    // The page asks the service rather than reading the status itself, so
    // what the screen offers and what the server accepts cannot drift.
    closed: appointmentMessagingClosed(appointment),
    status: appointment.status,
    petSilenced: isPetSilenced(appointment.pet),
    optedIn: appointment.client.notificationsOptIn,
    confirmation: composeFor(appointment, "APPOINTMENT_CONFIRMATION", clinic),
    reminder: composeFor(appointment, "APPOINTMENT_REMINDER", clinic),
  };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

interface DeliveryTarget {
  appointmentId?: string;
  reminderId?: string;
  clientId: string;
  kind: "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER" | "REMINDER_DUE";
  recipient: string;
  language: "tr" | "en";
  body: string;
}

/**
 * Sends over the clinic's channel and records the outcome. Throws an
 * AppError (already logged as FAILED) when the provider rejects the message.
 */
async function deliver(
  clinic: ClinicMessagingProfile,
  target: DeliveryTarget,
  actorId: string | null,
) {
  const channel = clinic.notifications.channel;
  const transport = getTransport(channel);
  if (!transport?.isConfigured()) {
    throw new AppError("VALIDATION_FAILED", "error.notifications.notConfigured");
  }
  const base = {
    clinicId: clinic.id,
    appointmentId: target.appointmentId,
    reminderId: target.reminderId,
    clientId: target.clientId,
    channel,
    kind: target.kind,
    recipient: target.recipient,
    language: target.language,
    body: target.body,
  };
  try {
    const { providerId } = await transport.send({
      to: target.recipient,
      body: target.body,
      language: target.language,
    });
    const log = await prisma.messageLog.create({
      data: { ...base, status: "SENT", providerId: providerId || null },
    });
    await writeAudit({
      clinicId: clinic.id,
      actorId,
      action: "CREATE",
      entityType: "MessageLog",
      entityId: log.id,
      metadata: { channel, kind: target.kind, transport: transport.name },
    });
    return log;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // The stable code is what gets stored, not the provider's sentence.
    //
    // A transport already classifies what went wrong ("sender title not
    // registered"), and the sentence beside it is free text the provider
    // may reword at any time. Storing the sentence meant the screen had
    // nothing it could classify: whether a failure is the clinic's to fix
    // or this one message's could only be recovered by matching wording,
    // which works until the wording changes and is then quietly wrong.
    // The sentence is not lost -- it goes to the log line below, where a
    // person reads it and no code depends on it.
    const stored = error instanceof TransportError ? error.code : detail;
    logger.error("notifications.send_failed", {
      channel,
      transport: transport.name,
      kind: target.kind,
      appointmentId: target.appointmentId,
      reminderId: target.reminderId,
      code: stored,
      err: detail,
    });
    await prisma.messageLog.create({
      data: { ...base, status: "FAILED", error: stored.slice(0, 500) },
    });
    throw new AppError("VALIDATION_FAILED", "error.notifications.sendFailed");
  }
}

function appointmentTarget(
  appointment: LoadedAppointment,
  kind: AppointmentMessageKind,
  clinic: ClinicMessagingProfile,
): DeliveryTarget {
  const composed = composeFor(appointment, kind, clinic);
  if (!composed.recipient) throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");
  return {
    appointmentId: appointment.id,
    clientId: appointment.client.id,
    kind,
    recipient: composed.recipient,
    language: composed.language,
    body: composed.body,
  };
}

/** Staff-initiated send from the appointment page. */
export async function sendAppointmentMessage(
  appointmentId: string,
  kind: AppointmentMessageKind,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const [appointment, clinic] = await Promise.all([
    loadAppointment(ctx.clinicId, appointmentId),
    getClinicMessagingProfile(ctx.clinicId),
  ]);
  if (!appointment || !clinic) throw notFound("appointment", appointmentId);
  if (isAppointmentClosed(appointment.status))
    throw new AppError("VALIDATION_FAILED", "error.notifications.appointmentClosed");
  if (isAppointmentPast(appointment.startsAt, new Date()))
    throw new AppError("VALIDATION_FAILED", "error.notifications.appointmentPast");
  if (isPetSilenced(appointment.pet))
    throw new AppError("VALIDATION_FAILED", "error.notifications.petSilenced");
  if (!appointment.client.notificationsOptIn)
    throw new AppError("VALIDATION_FAILED", "error.notifications.optedOut");
  return deliver(clinic, appointmentTarget(appointment, kind, clinic), ctx.userId);
}

/**
 * Staff sent the message themselves — copied it, or opened it in WhatsApp —
 * and this keeps the trail. Written on the clinic's own channel: hard-coding
 * WhatsApp recorded an SMS clinic's manual sends as WhatsApp ones, body and
 * all, and every count drawn from `message_logs` inherited that.
 *
 * The row is `MANUAL`, never `SENT`: "the loop works" is measured by what
 * the app delivered, not by what a person carried out of it by hand.
 */
export async function logManualMessage(
  appointmentId: string,
  kind: AppointmentMessageKind,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "appointments.write");
  const [appointment, clinic] = await Promise.all([
    loadAppointment(ctx.clinicId, appointmentId),
    getClinicMessagingProfile(ctx.clinicId),
  ]);
  if (!appointment || !clinic) throw notFound("appointment", appointmentId);
  // Logging a manual send is a claim that this message went out; it must not
  // be possible to record one the app itself would refuse to send.
  if (isAppointmentClosed(appointment.status))
    throw new AppError("VALIDATION_FAILED", "error.notifications.appointmentClosed");
  if (isAppointmentPast(appointment.startsAt, new Date()))
    throw new AppError("VALIDATION_FAILED", "error.notifications.appointmentPast");
  if (isPetSilenced(appointment.pet))
    throw new AppError("VALIDATION_FAILED", "error.notifications.petSilenced");
  const channel = clinic.notifications.channel;
  const composed = composeFor(appointment, kind, clinic, channel);
  if (!composed.recipient) throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");
  return prisma.messageLog.create({
    data: {
      clinicId: clinic.id,
      appointmentId: appointment.id,
      clientId: appointment.client.id,
      channel,
      kind,
      recipient: composed.recipient,
      language: composed.language,
      body: composed.body,
      status: "MANUAL",
    },
  });
}

/**
 * Called right after an appointment is created. Best effort: a messaging
 * hiccup must never fail the booking itself.
 */
export async function notifyAppointmentBooked(appointmentId: string, ctx: ActionContext) {
  try {
    const clinic = await getClinicMessagingProfile(ctx.clinicId);
    if (!clinic?.notifications.whatsapp.enabled) return;
    if (!clinic.notifications.whatsapp.confirmOnBooking) return;
    if (!isChannelConfigured(clinic.notifications.channel)) return;
    const appointment = await loadAppointment(ctx.clinicId, appointmentId);
    if (!appointment?.client.phone || !appointment.client.notificationsOptIn) return;
    // The same gate the screen and the manual send already use, and the one
    // this path was missing. Back-dating an appointment is ordinary clinic
    // work — writing up yesterday's walk-in — and it was sending the owner
    // "your appointment has been booked" for a time that had already gone
    // by. Worse than the message itself: the appointment page was refusing
    // to offer that very message while the server had already sent it,
    // which is the exact drift `previewAppointmentMessages` says must not
    // happen. A confirmation is only true for an appointment still ahead
    // and still open, whether it was typed in late or created cancelled.
    if (appointmentMessagingClosed(appointment)) return;
    if (isPetSilenced(appointment.pet)) return;
    await deliver(
      clinic,
      appointmentTarget(appointment, "APPOINTMENT_CONFIRMATION", clinic),
      ctx.userId,
    );
  } catch (error) {
    logger.warn("notifications.confirmation_skipped", {
      appointmentId,
      err: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Reminder sweep (cron)
// ---------------------------------------------------------------------------

/**
 * Why a row the sweep considered got no message.
 *
 * "0 sent" says nothing on its own: it reads the same whether nobody was
 * due, nobody had consented, or there was nobody there at all — and those
 * are three different jobs for three different people. A zero can mean
 * the absence of a defect or the inability to produce one, and the only
 * way to tell is to name what was eliminated and by what rule.
 *
 * Every row in the sweep's window is counted exactly once, under the
 * first reason that applies, so `pool = sent + failed + Σ skipped`.
 *
 * The first five are decided inside the candidate query and deliberately
 * so: an automatic send reaches an owner with nobody watching, and a
 * guard that lives after the read is one somebody can forget to call.
 * They are counted by a separate aggregate query rather than by widening
 * the candidate query — the census must not pull rows into memory that
 * the sweep has already decided it will not write to.
 */
export const SWEEP_SKIP_REASONS = [
  /** Cancelled, missed or already done — or a reminder no longer pending. */
  "closed",
  "clientArchived",
  "noPhone",
  /**
   * Asked, and told no. A decision, not a gap -- which is why it is
   * counted apart from the one below.
   */
  "optedOut",
  /** Nobody asked. The only one of the two with anything to do about it. */
  "neverAsked",
  /** The animal died or was archived; nothing is written about it. */
  "petSilenced",
  /** A message for this row already went out, by us or by hand. */
  "alreadySent",
  "attemptsExhausted",
  /** Failed recently; a later sweep tries again. */
  "coolingOff",
  /** Its hour has not come yet. This is the healthy zero. */
  "notDue",
  /** A number that is stored but cannot be dialled. */
  "noRecipient",
  /**
   * The same words had just gone to the same number.
   *
   * Ours, and decided rather than discovered: two reminders for one
   * animal on one day compose an identical SMS, because the text is
   * built from the owner, the animal, the type and the day and never
   * reads the title or the body.
   */
  "duplicateSuppressed",
] as const;

export type SweepSkipReason = (typeof SWEEP_SKIP_REASONS)[number];

export interface SweepKindSummary {
  /** Every row in the window, before a single rule was applied. */
  pool: number;
  /** What survived the candidate query. Should equal pool minus its skips. */
  candidates: number;
  sent: number;
  failed: number;
  /** Clinics that have this half of the loop switched off. */
  clinicsDisabled: number;
  skipped: Record<SweepSkipReason, number>;
}

export interface SweepSummary {
  configured: boolean;
  clinics: {
    total: number;
    /** Swept: messaging on and the channel actually configured. */
    swept: number;
    messagingOff: number;
    channelNotConfigured: number;
  };
  appointments: SweepKindSummary;
  reminders: SweepKindSummary;
}

function emptyKindSummary(): SweepKindSummary {
  return {
    pool: 0,
    candidates: 0,
    sent: 0,
    failed: 0,
    clinicsDisabled: 0,
    skipped: Object.fromEntries(SWEEP_SKIP_REASONS.map((r) => [r, 0])) as Record<
      SweepSkipReason,
      number
    >,
  };
}

interface CensusRow {
  reason: string;
  n: number;
}

/**
 * Folds a census into the summary: the pool is what the window held, and
 * everything the candidate query dropped lands under its own reason.
 */
function applyCensus(rows: CensusRow[], into: SweepKindSummary): void {
  for (const row of rows) {
    into.pool += row.n;
    if (row.reason === "eligible") continue;
    into.skipped[row.reason as SweepSkipReason] += row.n;
  }
}

/**
 * The same eliminations the appointment candidate query makes, counted
 * in the database instead of carried back as rows. The order of the
 * branches decides which reason a doubly-disqualified row is filed
 * under; it does not change which rows come out eligible, and eligible
 * is the number that has to agree with the candidate query.
 */
/**
 * Consent, classified once for both censuses.
 *
 * `NULL` and `FALSE` were one bucket, and they are two different
 * facts about a clinic: nobody asked, versus somebody asked and was
 * told no. A settings screen counting the first as work to do would
 * count the second as work too -- and an owner who said no is not
 * missing data, it is a decision. Presenting it as a gap objects to
 * the vet's own relationship with their client, on our behalf.
 *
 * One fragment, interpolated into both queries, because two copies of
 * a classification eventually become two different numbers. The unit
 * stays the row, not the distinct client: the census counts what the
 * sweep would have looked at, and switching one line to
 * COUNT(DISTINCT) would make the columns stop adding up.
 */
const CONSENT_CENSUS = Prisma.sql`
  WHEN c."notificationsOptIn" IS NULL THEN 'neverAsked'
  WHEN c."notificationsOptIn" = FALSE THEN 'optedOut'
`;

function appointmentCensus(clinicId: string, from: Date, to: Date) {
  return prisma.$queryRaw<CensusRow[]>(Prisma.sql`
    SELECT CASE
             WHEN a.status NOT IN ('SCHEDULED', 'CONFIRMED') THEN 'closed'
             WHEN c."archivedAt" IS NOT NULL THEN 'clientArchived'
             WHEN c.phone IS NULL THEN 'noPhone'
             ${CONSENT_CENSUS}
             WHEN p.deceased OR p."archivedAt" IS NOT NULL THEN 'petSilenced'
             ELSE 'eligible'
           END AS reason,
           COUNT(*)::int AS n
      FROM "appointments" a
      JOIN "clients" c ON c.id = a."clientId"
      JOIN "pets" p ON p.id = a."petId"
     WHERE a."clinicId" = ${clinicId}
       AND a."startsAt" > ${from}
       AND a."startsAt" <= ${to}
     GROUP BY 1
  `);
}

/** The same, for reminders. A reminder naming no animal cannot be silenced by one. */
function reminderCensus(clinicId: string, from: Date, to: Date) {
  return prisma.$queryRaw<CensusRow[]>(Prisma.sql`
    SELECT CASE
             WHEN r.status <> 'PENDING' THEN 'closed'
             WHEN c."archivedAt" IS NOT NULL THEN 'clientArchived'
             WHEN c.phone IS NULL THEN 'noPhone'
             ${CONSENT_CENSUS}
             WHEN p.id IS NOT NULL AND (p.deceased OR p."archivedAt" IS NOT NULL)
               THEN 'petSilenced'
             ELSE 'eligible'
           END AS reason,
           COUNT(*)::int AS n
      FROM "reminders" r
      JOIN "clients" c ON c.id = r."clientId"
      LEFT JOIN "pets" p ON p.id = r."petId"
     WHERE r."clinicId" = ${clinicId}
       AND r."dueAt" >= ${from}
       AND r."dueAt" <= ${to}
     GROUP BY 1
  `);
}

/** A failed attempt waits this long before the sweep tries the same one again. */
export const MIN_RETRY_INTERVAL_MS = 6 * 3_600_000;

/**
 * How long the provider refuses a repeat of the same text to the same
 * number. Netgsm's own filter, not a rule of ours, which is why it is
 * an hour and not something we chose -- and why the sweep's six-hour
 * wait clears it six times over.
 */
export const DUPLICATE_WINDOW_MS = 3_600_000;

/**
 * How far back the sweep looks before deciding two reminders would say
 * the same thing to the same person.
 *
 * A day, and not the provider's hour: the operator's filter protects
 * its own network, this protects the owner. The composed text names a
 * due date at day granularity, so two identical texts are about the
 * same day's work however many hours apart the reminders fell due.
 */
export const DUPLICATE_SUPPRESSION_WINDOW_MS = 24 * 3_600_000;

/**
 * Whether the sweep should leave this candidate alone for now.
 *
 * Three rules, and the middle one is why this function exists: a provider
 * that rejected a message once (a gateway outage, a sender title pending
 * approval) usually rejects it again a minute later, and the sweep now runs
 * hourly. Without a wait the three attempts a candidate gets would be spent
 * inside three hours, on the same outage, and the reminder would never be
 * sent at all.
 *
 * - Already sent, by us or by hand: never send again.
 * - Three failures: stop, and let someone look at it.
 * - Failed recently: wait, the attempt is not lost.
 */
/**
 * The failures that count against a reminder's three attempts.
 *
 * One definition, used by the sweep's decision and by the sentence on
 * the row, because they are the same fact: whether anything automatic
 * will try again. They had drifted -- `847e569` stopped our own
 * duplicate blocks from spending attempts in the sweep and left the
 * row computing exhaustion from every failure, so a reminder could
 * read "no further attempts" while the sweep was still going to try.
 *
 * `PRODUCT` failures are ours: the provider refused a repeat of a
 * message it had just accepted, which is evidence the first one went,
 * not a reason to give up on this one.
 */
export function spentAttempts(
  messages: { status: string; error?: string | null }[],
): number {
  return messages.filter((m) => m.status === "FAILED" && failureScope(m.error) !== "PRODUCT")
    .length;
}

export function automaticSendBlock(
  messages: { status: string; createdAt: Date; error?: string | null }[],
  now: Date,
):
  | Extract<
      SweepSkipReason,
      "alreadySent" | "attemptsExhausted" | "coolingOff" | "duplicateSuppressed"
    >
  | null {
  if (messages.some((m) => m.status === "SENT" || m.status === "MANUAL")) return "alreadySent";
  // Decided once and recorded, so later runs stop reconsidering it.
  // Without the row the run-local check would only ever see its own
  // run, and the twin would go out on the next one.
  if (messages.some((m) => m.status === "SUPPRESSED")) return "duplicateSuppressed";

  const failures = messages.filter((m) => m.status === "FAILED");
  // A failure we caused does not spend one of the reminder's three
  // attempts.
  //
  // The duplicate block is the case: the provider refuses the same
  // text to the same number inside an hour, so it fires when we sent
  // the same thing twice -- and it is evidence the earlier message was
  // ACCEPTED, not that this one cannot be. Counting it meant three of
  // our own repeats could exhaust a reminder's budget and the sweep
  // would abandon it for good, silently. That is this morning's defect
  // with a new cause.
  //
  // Clinic-caused failures still count, deliberately. Three attempts
  // against an unapproved sender title are equally futile, but a
  // banner is already saying so on the screen: that abandonment is
  // visible, and this one was not.
  if (spentAttempts(messages) >= MAX_AUTOMATIC_ATTEMPTS) return "attemptsExhausted";
  if (failures.length === 0) return null;

  const lastFailure = Math.max(...failures.map((m) => m.createdAt.getTime()));
  return now.getTime() - lastFailure < MIN_RETRY_INTERVAL_MS ? "coolingOff" : null;
}

/** The same decision as a yes-or-no, for callers that do not report why. */
export function automaticSendBlocked(
  messages: { status: string; createdAt: Date; error?: string | null }[],
  now: Date,
): boolean {
  return automaticSendBlock(messages, now) !== null;
}

export async function runReminderSweep(now = new Date()): Promise<SweepSummary> {
  const summary: SweepSummary = {
    configured: false,
    clinics: { total: 0, swept: 0, messagingOff: 0, channelNotConfigured: 0 },
    appointments: emptyKindSummary(),
    reminders: emptyKindSummary(),
  };

  // Only the clinics that could send anything, chosen in the database.
  //
  // This runs every fifteen minutes -- ninety-six times a day once the
  // external scheduler is on (DEPLOY.md) -- and it used to read every
  // clinic row, settings JSON and all, to discard all but three of them
  // in JavaScript. That is work proportional to the whole clinics table
  // on a job whose actual subject is the handful with messaging on, and
  // it grows in the one direction the table is certain to grow.
  //
  // The count stays, because "180 clinics have this switched off" is
  // exactly the kind of zero this summary exists to name, and losing it
  // would make "nothing was sent" unreadable again.
  //
  // Still a sequential scan -- 0.085 ms over 183 rows, measured -- and
  // deliberately left as one: a partial expression index on this JSON
  // path cannot be written in the schema (Prisma), so it would live in
  // a migration alone, and it does not earn that until clinics number
  // in the tens of thousands. The number is here so the next person
  // does not have to measure it again to decide.
  const [total, clinics] = await Promise.all([
    prisma.clinic.count(),
    prisma.clinic.findMany({
      where: {
        settings: { path: ["notifications", "whatsapp", "enabled"], equals: true },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        timezone: true,
        settings: true,
      },
    }),
  ]);
  const horizon = new Date(now.getTime() + 8 * 86_400_000);
  summary.clinics.total = total;
  summary.clinics.messagingOff = total - clinics.length;

  for (const row of clinics) {
    const clinic = toMessagingProfile(row);
    const cfg = clinic.notifications.whatsapp;
    // Belt and braces: the filter above and the parser here have to
    // agree about what "on" means, and if they ever stop agreeing the
    // count says so rather than a message going out unasked.
    if (!cfg.enabled) {
      summary.clinics.messagingOff++;
      continue;
    }
    if (!isChannelConfigured(clinic.notifications.channel)) {
      summary.clinics.channelNotConfigured++;
      continue;
    }
    summary.configured = true;
    summary.clinics.swept++;

    if (cfg.reminder.mode === "off") summary.appointments.clinicsDisabled++;
    else {
      const appointments = summary.appointments;
      const hold = (reason: SweepSkipReason) => summary.appointments.skipped[reason]++;
      applyCensus(await appointmentCensus(clinic.id, now, horizon), appointments);
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId: clinic.id,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          startsAt: { gt: now, lte: horizon },
          client: { archivedAt: null, phone: { not: null }, notificationsOptIn: true },
          // A dead or archived animal is never written about, however the
          // appointment was left behind.
          pet: { deceased: false, archivedAt: null },
        },
        include: {
          ...APPOINTMENT_INCLUDE,
          messages: {
            where: { kind: "APPOINTMENT_REMINDER" },
            select: { status: true, createdAt: true },
          },
        },
      });
      appointments.candidates += candidates.length;
      for (const appointment of candidates) {
        const blocked = automaticSendBlock(appointment.messages, now);
        if (blocked) {
          hold(blocked);
          continue;
        }
        if (!isReminderDue(appointment.startsAt, now, cfg.reminder, clinic.timezone)) {
          hold("notDue");
          continue;
        }
        // Built before the send, because the only thing it can refuse over
        // is a number that will not normalize — which is a skip with a
        // name, not the failure of an attempt that never left the house.
        let target: DeliveryTarget;
        try {
          target = appointmentTarget(appointment, "APPOINTMENT_REMINDER", clinic);
        } catch {
          hold("noRecipient");
          continue;
        }
        try {
          await deliver(clinic, target, null);
          appointments.sent++;
        } catch {
          appointments.failed++;
        }
      }
    }

    if (!cfg.reminders.enabled) summary.reminders.clinicsDisabled++;
    else {
      const { from: reminderFloor, to: reminderHorizon } = reminderNoticeWindow(
        now,
        cfg.reminders,
      );
      // What this run has already said, and to whom. Per clinic,
      // because the number is the key and two clinics never share one.
      const sentInRun = new Set<string>();
      const remindersSummary = summary.reminders;
      const hold = (reason: SweepSkipReason) => remindersSummary.skipped[reason]++;
      applyCensus(
        await reminderCensus(clinic.id, reminderFloor, reminderHorizon),
        remindersSummary,
      );
      const reminders = await prisma.reminder.findMany({
        where: {
          clinicId: clinic.id,
          status: "PENDING",
          dueAt: { gte: reminderFloor, lte: reminderHorizon },
          client: { archivedAt: null, phone: { not: null }, notificationsOptIn: true },
          // Reminders can stand on their own, but one that names an animal
          // follows that animal: if it died or was archived, nothing goes out.
          OR: [{ petId: null }, { pet: { deceased: false, archivedAt: null } }],
        },
        include: {
          pet: { select: { name: true } },
          client: { select: CLIENT_SELECT },
          messages: {
            where: { kind: "REMINDER_DUE" },
            select: { status: true, createdAt: true, error: true },
          },
        },
      });
      remindersSummary.candidates += reminders.length;
      for (const reminder of reminders) {
        const blocked = automaticSendBlock(reminder.messages, now);
        if (blocked) {
          hold(blocked);
          continue;
        }
        if (
          !isReminderNoticeDue(
            reminder.dueAt,
            now,
            cfg.reminders.daysBefore,
            cfg.reminder.morningHour,
            clinic.timezone,
          )
        ) {
          hold("notDue");
          continue;
        }
        const language = toMessageLocale(reminder.client.preferredLanguage);
        const recipient = normalizePhone(reminder.client.phone, countryCallingCode(clinic.country));
        if (!recipient) {
          hold("noRecipient");
          continue;
        }
        const body = composeReminderFor(clinic.notifications.channel, {
          locale: language,
          clientName: `${reminder.client.firstName} ${reminder.client.lastName}`.trim(),
          petName: reminder.pet?.name,
          type: reminder.type,
          title: reminder.title,
          body: reminder.body,
          dueAt: reminder.dueAt,
          clinic,
        });

        // Would this be the same sentence, to the same person, twice?
        //
        // The SMS is built from the owner, the animal, the type and the
        // day: neither the title nor the body reaches it. So a vet who
        // writes "Kuduz aşısı" and "Karma aşı" for one animal on one day
        // has written two pieces of work whose messages are identical
        // word for word, and both are candidates in the same run.
        //
        // Two checks, because one run cannot see the other: the set
        // covers twins that come up together, the query covers a twin
        // whose partner went out earlier. Neither is the provider's
        // duplicate filter -- that one protects its network inside an
        // hour, this protects the owner from reading the same thing
        // twice.
        const twinKey = `${recipient}|${body}`;
        const alreadySaid =
          sentInRun.has(twinKey) ||
          (await prisma.messageLog.findFirst({
            where: {
              clinicId: clinic.id,
              recipient,
              body,
              status: { in: ["SENT", "MANUAL"] },
              createdAt: { gte: new Date(now.getTime() - DUPLICATE_SUPPRESSION_WINDOW_MS) },
            },
            select: { id: true },
          }));
        if (alreadySaid) {
          // A row of its own, and this is the point of it. Left with
          // nothing the reminder is indistinguishable from one waiting
          // its turn -- the screen would promise a send that is never
          // coming, and the next run would weigh it again. What the
          // vet decides about the second piece of work is theirs; the
          // product's job is to say plainly that its message did not
          // go and why.
          await prisma.messageLog.create({
            data: {
              clinicId: clinic.id,
              reminderId: reminder.id,
              clientId: reminder.client.id,
              channel: clinic.notifications.channel,
              kind: "REMINDER_DUE",
              recipient,
              language,
              body,
              status: "SUPPRESSED",
            },
          });
          hold("duplicateSuppressed");
          continue;
        }

        try {
          await deliver(
            clinic,
            {
              reminderId: reminder.id,
              clientId: reminder.client.id,
              kind: "REMINDER_DUE",
              recipient,
              language,
              body,
            },
            null,
          );
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: "SENT", sentAt: now },
          });
          sentInRun.add(twinKey);
          remindersSummary.sent++;
        } catch {
          remindersSummary.failed++;
        }
      }
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// One reminder's delivery: what happened, and what will
// ---------------------------------------------------------------------------

/**
 * What a reminder row can honestly say about its own message.
 *
 * Read from `MessageLog`, never from `Reminder.status`. The two answer
 * different questions and only one of them is about delivery: the
 * status is the vet's decision (this piece of work is open, closed,
 * dropped), the log is the provider's fact (it went, it did not, here is
 * why and on which attempt). A screen that reads the status can say
 * "sent" about a message that was rejected three times.
 */
/**
 * The days a reminder notice can be acted on: yesterday, through the
 * clinic's notice lead time plus two.
 *
 * Exported and shared rather than recomputed, because two things now
 * ask the question. The sweep asks "what may I send"; a screen asks
 * "what will not go out", and the second is only honest inside the
 * same horizon as the first. A count over all time would report work
 * that is not work yet, and a second copy of this arithmetic would
 * drift from the sweep the first time a clinic changed its lead time.
 *
 * The floor is a day back, matching the sweep: a notice whose day has
 * just passed is still worth sending.
 */
export function reminderNoticeWindow(
  now: Date,
  reminders: { daysBefore: number },
): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - 86_400_000),
    to: new Date(now.getTime() + (reminders.daysBefore + 2) * 86_400_000),
  };
}

export type ReminderDeliveryState =
  | { state: "scheduled"; sendAt: Date; channel: Channel }
  /** The provider says it reached a handset. The only state that claims arrival. */
  | { state: "delivered"; at: Date; channel: Channel }
  /** Accepted, and the answer has not come back yet. A wait, not a failure. */
  | { state: "sentAwaitingReport"; at: Date; channel: Channel }
  /** Accepted, and it did not arrive. Same family as `noPhone`: reach for the phone. */
  | { state: "undelivered"; at: Date; channel: Channel }
  /**
   * Accepted on a channel that has no report source at all.
   *
   * Kept apart from the wait above because nothing is being waited
   * for: promising a report that can never come is the same defect as
   * a silent row, seen from the other side.
   */
  | { state: "sentNoReportChannel"; at: Date; channel: Channel }
  /** The validity period ran out. We do not know that it failed, only that we stopped hearing. */
  | { state: "reportExpired"; at: Date; channel: Channel }
  /**
   * Composed and held back: the same words had just gone to the same
   * number, from another reminder for the same animal on the same day.
   *
   * Information, not a warning. Nothing failed and nobody needs to be
   * phoned -- the owner did receive the sentence, once. Whether the
   * second piece of work still needs doing is the vet's call, and the
   * two rows sit next to each other so they can make it.
   */
  | { state: "duplicateSuppressed"; at: Date; channel: Channel }
  | {
      state: "failed";
      at: Date;
      /** The transport's stable code, for logs. Not a sentence to show. */
      error: string | null;
      attempts: number;
      /** No automatic attempt is left; only a person can move this now. */
      exhausted: boolean;
      /** Whose problem it is, or null when nothing here can say. */
      scope: FailureScope | null;
      channel: Channel;
    }
  | { state: "optedOut" }
  | { state: "neverAsked" }
  | { state: "petSilenced" }
  | { state: "noPhone" }
  | { state: "notConfigured"; channel: Channel }
  /** Somebody opened the settings and switched sending off. */
  | { state: "disabled" }
  /**
   * Nobody has ever set this clinic up.
   *
   * Not the same as switched off, and the difference is what a vet
   * should do next: turn it on, versus remember that you turned it
   * off. Collapsing them told a clinic that had never seen the
   * settings page that it had decided against messaging.
   */
  | { state: "notSetUp" }
  | null;

export interface ReminderDeliveryRow {
  status: string;
  dueAt: Date;
  client: { phone: string | null; notificationsOptIn: boolean | null };
  pet?: { deceased: boolean; archivedAt: Date | null } | null;
  messages: {
    status: string;
    createdAt: Date;
    error: string | null;
    channel: Channel;
    deliveryStatus?: MessageDeliveryStatus;
    deliveredAt?: Date | null;
  }[];
}

/**
 * The order of these branches is the whole contract.
 *
 * History first: `sent` and `failed` are facts, and a fact stays true
 * after somebody switches the channel off — a row that went out last
 * Tuesday must not start claiming "messaging is disabled" because a
 * setting changed today. Then the reasons nothing will go. Only what
 * survives all of it is `scheduled`, which is a promise, and the one
 * answer here that the product still has to keep.
 *
 * `null` means there is nothing truthful to say: the reminder is closed
 * and nothing was ever sent for it, or it names an animal that died, in
 * which case no message will go and none was refused either.
 */
export function reminderDeliveryState(
  reminder: ReminderDeliveryRow,
  clinic: ClinicMessagingProfile,
): ReminderDeliveryState {
  const newestFirst = [...reminder.messages].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  // MANUAL counts as sent for the same reason the sweep counts it: a
  // person carried the message out of the app by hand, and sending it
  // again would reach the owner twice.
  const accepted = newestFirst.find((m) => m.status === "SENT" || m.status === "MANUAL");
  if (accepted) {
    const at = accepted.deliveredAt ?? accepted.createdAt;
    const channel = accepted.channel;
    switch (accepted.deliveryStatus) {
      case "DELIVERED":
        return { state: "delivered", at, channel };
      case "UNDELIVERED":
        return { state: "undelivered", at: accepted.createdAt, channel };
      case "EXPIRED":
        return { state: "reportExpired", at: accepted.createdAt, channel };
      default:
        // UNKNOWN or PENDING. Which of the two it is says who we are
        // waiting on, and neither is a failure -- but on a channel
        // that will never report, waiting is not what is happening
        // either, and saying so would invent a process we do not have.
        return {
          state: transportReportsDelivery(channel) ? "sentAwaitingReport" : "sentNoReportChannel",
          at: accepted.createdAt,
          channel,
        };
    }
  }

  // A held-back message and a failed one can both be in the history;
  // the newest is the one that describes where the reminder stands.
  const lastDecision = newestFirst.find(
    (m) => m.status === "SUPPRESSED" || m.status === "FAILED",
  );
  if (lastDecision?.status === "SUPPRESSED")
    return {
      state: "duplicateSuppressed",
      at: lastDecision.createdAt,
      channel: lastDecision.channel,
    };

  const failures = newestFirst.filter((m) => m.status === "FAILED");
  if (failures.length > 0)
    return {
      state: "failed",
      at: failures[0].createdAt,
      error: failures[0].error,
      // The sweep's count, not every failure: a duplicate block of our
      // own does not spend an attempt, so counting it here would show
      // "3 attempts" beside a reminder the sweep still intends to
      // retry. One number, one meaning -- two definitions of
      // exhaustion were enough for one day.
      attempts: spentAttempts(reminder.messages),
      // Derived here and not on the screen: the threshold is the sweep's
      // rule, and a copy of it in a component is a second place to
      // change when it moves. Counted the sweep's way too -- our own
      // duplicate blocks do not spend attempts, so a row must not say
      // "no further attempts" while the sweep is still going to try.
      exhausted: spentAttempts(reminder.messages) >= MAX_AUTOMATIC_ATTEMPTS,
      scope: failureScope(failures[0].error),
      channel: failures[0].channel,
    };

  // Nothing has been attempted, so everything below is about the future.
  //
  // A dead or archived animal has no future here, and that used to
  // return null -- a row that said nothing at all. Saying nothing is
  // the defect this whole sentence exists to remove: silence reads
  // exactly like "waiting", which is what a reminder looks like when
  // the loop is quietly not running. It gets its own answer.
  if (reminder.pet && isPetSilenced(reminder.pet)) return { state: "petSilenced" };
  // A closed reminder nothing was ever sent for is the one case with
  // genuinely nothing to report: nobody is waiting on it.
  if (reminder.status !== "PENDING") return null;

  const cfg = clinic.notifications.whatsapp;
  const channel = clinic.notifications.channel;
  // No channel at all comes first, and stays first: with nothing
  // configured even a manual send is refused, so nothing more specific
  // about this owner would change what can be done.
  if (!isChannelConfigured(channel)) return { state: "notConfigured", channel };
  // Refused and never asked are one falsy value in code and two
  // different mornings for a vet: nothing to do about the first, a
  // phone call about the second. The column keeps them apart
  // (prisma/schema.prisma) and so must everything reading it.
  if (reminder.client.notificationsOptIn === false) return { state: "optedOut" };
  if (reminder.client.notificationsOptIn !== true) return { state: "neverAsked" };
  if (!normalizePhone(reminder.client.phone, countryCallingCode(clinic.country)))
    return { state: "noPhone" };

  // Last, and it used to be first. The old order put the clinic-wide
  // switch ahead of the per-owner reasons, on the argument that with
  // messaging off every row is equally stuck and naming this owner's
  // consent would send the vet to the wrong screen.
  //
  // `ed0f364` ended that: sending by hand now works while the switch
  // is off, so the rows are no longer equally stuck. On a row whose
  // owner never consented there is still nothing to do, and saying
  // "notifications are off" there hides the only reason that matters
  // -- while on every other row the switch is exactly what the
  // sentence should name, beside a button that works.
  //
  // dev-ui found this, from the comment that used to justify the
  // opposite: a reason written down is what makes it checkable when
  // the thing underneath it moves.
  // `null` is "nobody has said anything", `false` is "somebody said
  // no". The reminders half only has a boolean, so an unset clinic
  // reads as never set up whatever that says.
  if (cfg.enabled === null) return { state: "notSetUp" };
  if (!cfg.enabled || !cfg.reminders.enabled) return { state: "disabled" };

  return {
    state: "scheduled",
    sendAt: reminderNoticeDueAt(
      reminder.dueAt,
      cfg.reminders.daysBefore,
      cfg.reminder.morningHour,
      clinic.timezone,
    ),
    channel,
  };
}

/**
 * Sends one reminder now, because somebody asked for it.
 *
 * The sweep's reminder body for a single row, with two differences.
 *
 * `actorId` is the user rather than `null`, so the audit trail keeps
 * "a person pressed this" apart from "the hourly sweep did it" — the
 * two are answerable by different people when an owner complains about
 * a message.
 *
 * And it refuses only a message that already went out. The sweep's
 * other two hold-backs exist to stop an unattended retry loop burning
 * its attempts on one provider outage; a person pressing send after
 * fixing the sender title is the escape hatch those rules assume
 * exists, and making them wait six hours would remove it.
 *
 * Every gate the sweep applies in its query is re-asked here. The
 * screen decides what to offer; the server decides what is allowed, and
 * a button is not a permission.
 */
export async function sendReminderNow(reminderId: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "reminders.write");
  const [reminder, clinic] = await Promise.all([
    prisma.reminder.findFirst({
      where: { id: reminderId, clinicId: ctx.clinicId },
      include: {
        pet: { select: { name: true, deceased: true, archivedAt: true } },
        client: { select: CLIENT_SELECT },
        messages: {
          where: { kind: "REMINDER_DUE" },
          select: { status: true, createdAt: true },
        },
      },
    }),
    getClinicMessagingProfile(ctx.clinicId),
  ]);
  if (!reminder || !clinic) throw notFound("reminder", reminderId);

  // The clinic's own switches are deliberately NOT checked here, and
  // this is the one place the manual path and the sweep must differ.
  //
  // `whatsapp.enabled` and `reminders.enabled` govern the automatic
  // loop: whether the app writes to owners unattended. Sending one
  // message by hand, on purpose, to a person you chose, is a different
  // act -- and it is how anyone comes to trust the loop enough to turn
  // it on. The vet who asked for it put it as a deadlock: "to trust it
  // I have to try it, to try it I have to switch it on, to switch it
  // on I have to trust it." Gating both on one switch closes the only
  // door in.
  //
  // The appointment page's manual send has never checked them either;
  // this path checking them was the two halves of one action
  // disagreeing about what is allowed.
  //
  // Everything else still applies below: consent, a dialable number, a
  // living animal, a configured channel. Those are not preferences.
  if (!isChannelConfigured(clinic.notifications.channel))
    throw new AppError("VALIDATION_FAILED", "error.notifications.notConfigured");
  if (reminder.pet && isPetSilenced(reminder.pet))
    throw new AppError("VALIDATION_FAILED", "error.notifications.petSilenced");
  if (!reminder.client.notificationsOptIn)
    throw new AppError("VALIDATION_FAILED", "error.notifications.optedOut");
  if (automaticSendBlock(reminder.messages, new Date()) === "alreadySent")
    throw new AppError("VALIDATION_FAILED", "error.notifications.alreadySent");
  // Note for whoever shortens the sweep's own wait: the sweep waits six
  // hours, the provider's duplicate window is one, so the sweep cannot
  // trip it. This path does not wait at all, by design -- which is why
  // it has to check for itself, below.

  const language = toMessageLocale(reminder.client.preferredLanguage);
  const recipient = normalizePhone(reminder.client.phone, countryCallingCode(clinic.country));
  if (!recipient) throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");

  const body = composeReminderFor(clinic.notifications.channel, {
    locale: language,
    clientName: `${reminder.client.firstName} ${reminder.client.lastName}`.trim(),
    petName: reminder.pet?.name,
    type: reminder.type,
    title: reminder.title,
    body: reminder.body,
    dueAt: reminder.dueAt,
    clinic,
  });

  // Refused here rather than by the provider, and the difference is
  // what the vet learns.
  //
  // The operator blocks the same text to the same number inside an
  // hour. Pressing send after a failure -- the one moment this button
  // exists for -- can land inside that window, and the provider's
  // answer arrives as another failed row: a second failure that says
  // nothing, for a message that already went. A vet reasonably
  // concludes the product is broken.
  //
  // Checked across the clinic and not just this reminder, because the
  // provider's filter is on the text and the number, and two different
  // reminders for one animal on one day compose the same words.
  const duplicateWindowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const recentlyAccepted = await prisma.messageLog.findFirst({
    where: {
      clinicId: ctx.clinicId,
      recipient,
      body,
      status: { in: ["SENT", "MANUAL"] },
      createdAt: { gte: duplicateWindowStart },
    },
    select: { id: true },
  });
  if (recentlyAccepted)
    throw new AppError("VALIDATION_FAILED", "error.notifications.duplicateWindow");

  const log = await deliver(
    clinic,
    {
      reminderId: reminder.id,
      clientId: reminder.client.id,
      kind: "REMINDER_DUE",
      recipient,
      language,
      body,
    },
    ctx.userId,
  );

  // Same closing move as the sweep: the piece of work has been acted on,
  // and the list must not offer it again as if nothing had happened.
  const sentAt = new Date();
  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: "SENT", sentAt },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Reminder",
    entityId: reminder.id,
    changes: { status: "SENT", sentAt },
  });
  return log;
}

// ---------------------------------------------------------------------------
// Delivery reports (cron)
// ---------------------------------------------------------------------------

/**
 * How many accepted messages one run asks the provider about.
 *
 * Netgsm answers one job id per call, so this is a call budget, not a
 * query budget. Fifty every fifteen minutes is 4,800 a day, comfortably
 * more than any clinic here sends, and it keeps one enormous backlog
 * from turning a cron run into a ten-minute HTTP loop.
 */
export const DELIVERY_REPORT_BATCH = 50;

/** Nothing is asked about a message younger than this; reports take time. */
export const DELIVERY_REPORT_MIN_AGE_MS = 5 * 60_000;

/** Nor older than this: Netgsm keeps reports for three months. */
export const DELIVERY_REPORT_MAX_AGE_DAYS = 90;

/** And a message already asked about waits this long before being asked again. */
export const DELIVERY_RECHECK_INTERVAL_MS = 6 * 3_600_000;

export interface DeliverySweepSummary {
  /** Accepted messages whose delivery is still an open question. */
  open: number;
  asked: number;
  answered: number;
  delivered: number;
  undelivered: number;
  expired: number;
  /** Asked, and the provider still does not know. Not a failure. */
  pending: number;
  /** Asked, and the provider said nothing at all about it. */
  silent: number;
  /**
   * When the oldest still-open message was accepted, or null if none.
   *
   * The detector for a wait that will never end. Some provider codes
   * are documented without saying what they imply, and those are left
   * unmapped on purpose -- so the poller keeps asking and the row
   * keeps saying "we have not heard". That is the right answer for a
   * day and the wrong one for a month, and this is the number that
   * tells the difference without anybody having to suspect it first.
   */
  oldestOpenAt: Date | null;
}

const DELIVERY_STATE_TO_STATUS = {
  delivered: "DELIVERED",
  undelivered: "UNDELIVERED",
  expired: "EXPIRED",
  pending: "PENDING",
} as const;

/**
 * Asks the provider what became of the messages it accepted.
 *
 * `SENT` has only ever meant "the operator took it", and until now that
 * was the last thing the app ever learned. A message that the operator
 * accepted and then could not deliver looked exactly like one sitting
 * in somebody's hand.
 *
 * Polling rather than a webhook, and not by preference: Netgsm's
 * webhook covers İYS and voice, not SMS. A webhook would also need a
 * public URL and provider-side setup, which means it could never be
 * exercised in `log` mode -- and being ready before the account exists
 * is the entire point of writing this now.
 */
export async function runDeliveryReportSweep(
  now = new Date(),
): Promise<DeliverySweepSummary> {
  const summary: DeliverySweepSummary = {
    open: 0,
    asked: 0,
    answered: 0,
    delivered: 0,
    undelivered: 0,
    expired: 0,
    pending: 0,
    silent: 0,
    oldestOpenAt: null,
  };

  // Only messages the provider accepted: a FAILED row never reached it,
  // and a MANUAL one never went through it at all.
  const where = {
    status: "SENT" as const,
    providerId: { not: null },
    deliveryStatus: { in: ["UNKNOWN", "PENDING"] as MessageDeliveryStatus[] },
    createdAt: {
      lte: new Date(now.getTime() - DELIVERY_REPORT_MIN_AGE_MS),
      gte: new Date(now.getTime() - DELIVERY_REPORT_MAX_AGE_DAYS * 86_400_000),
    },
    OR: [
      { deliveryCheckedAt: null },
      { deliveryCheckedAt: { lte: new Date(now.getTime() - DELIVERY_RECHECK_INTERVAL_MS) } },
    ],
  };

  // The count is what makes a small `asked` readable: fifty asked out of
  // fifty open is a finished run, fifty out of nine hundred is a backlog
  // the schedule is not keeping up with, and the two look identical
  // without it.
  summary.open = await prisma.messageLog.count({ where });
  if (summary.open === 0) return summary;

  const rows = await prisma.messageLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: DELIVERY_REPORT_BATCH,
    select: { id: true, channel: true, providerId: true, createdAt: true },
  });
  // Oldest first, so the first row is it. Read before anything is
  // written, because a run that resolves it should still report that
  // it was this old when the run started.
  summary.oldestOpenAt = rows[0]?.createdAt ?? null;

  // Grouped by channel because each channel has its own provider, and a
  // transport that cannot answer at all is left alone rather than being
  // asked and reported as silent -- those are different facts.
  const byChannel = new Map<Channel, { id: string; providerId: string }[]>();
  for (const row of rows) {
    if (!row.providerId) continue;
    const list = byChannel.get(row.channel) ?? [];
    list.push({ id: row.id, providerId: row.providerId });
    byChannel.set(row.channel, list);
  }

  for (const [channel, batch] of byChannel) {
    const transport = getTransport(channel);
    if (!transport?.isConfigured() || !transport.reports) continue;
    summary.asked += batch.length;

    let reports: Record<string, { state: keyof typeof DELIVERY_STATE_TO_STATUS; code: string | null; at: Date | null }>;
    try {
      reports = await transport.reports(batch.map((b) => b.providerId));
    } catch (error) {
      // A provider outage must not look like a delivery answer. Nothing
      // is written, `deliveryCheckedAt` stays where it was, and the next
      // run asks the same messages again.
      logger.error("notifications.delivery_report_failed", {
        channel,
        transport: transport.name,
        asked: batch.length,
        err: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const { id, providerId } of batch) {
      const report = reports[providerId];
      if (!report) {
        // Asked and not answered. Stamped anyway, so the next run moves
        // on to messages nobody has asked about yet instead of circling
        // the same silent ones.
        summary.silent++;
        await prisma.messageLog.update({
          where: { id },
          data: { deliveryCheckedAt: now },
        });
        continue;
      }
      summary.answered++;
      const status = DELIVERY_STATE_TO_STATUS[report.state];
      summary[report.state === "pending" ? "pending" : report.state]++;
      await prisma.messageLog.update({
        where: { id },
        data: {
          deliveryStatus: status,
          // Only a delivered message has a delivery time. Writing "now"
          // for the others would make `deliveredAt` mean "when we last
          // heard", and every count drawn from it would be wrong.
          deliveredAt: report.state === "delivered" ? (report.at ?? now) : null,
          deliveryCode: report.code,
          deliveryCheckedAt: now,
        },
      });
    }
  }

  return summary;
}
