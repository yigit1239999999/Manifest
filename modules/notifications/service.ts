import { Prisma } from "@/generated/prisma/client";
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
import { getTransport, isChannelConfigured } from "@/lib/messaging/transports";
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
  /** Refused, or never asked: a null consent is a "no" everywhere. */
  "optedOut",
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
function appointmentCensus(clinicId: string, from: Date, to: Date) {
  return prisma.$queryRaw<CensusRow[]>(Prisma.sql`
    SELECT CASE
             WHEN a.status NOT IN ('SCHEDULED', 'CONFIRMED') THEN 'closed'
             WHEN c."archivedAt" IS NOT NULL THEN 'clientArchived'
             WHEN c.phone IS NULL THEN 'noPhone'
             WHEN c."notificationsOptIn" IS NOT TRUE THEN 'optedOut'
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
             WHEN c."notificationsOptIn" IS NOT TRUE THEN 'optedOut'
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
export function automaticSendBlock(
  messages: { status: string; createdAt: Date }[],
  now: Date,
): Extract<SweepSkipReason, "alreadySent" | "attemptsExhausted" | "coolingOff"> | null {
  if (messages.some((m) => m.status === "SENT" || m.status === "MANUAL")) return "alreadySent";

  const failures = messages.filter((m) => m.status === "FAILED");
  if (failures.length >= MAX_AUTOMATIC_ATTEMPTS) return "attemptsExhausted";
  if (failures.length === 0) return null;

  const lastFailure = Math.max(...failures.map((m) => m.createdAt.getTime()));
  return now.getTime() - lastFailure < MIN_RETRY_INTERVAL_MS ? "coolingOff" : null;
}

/** The same decision as a yes-or-no, for callers that do not report why. */
export function automaticSendBlocked(
  messages: { status: string; createdAt: Date }[],
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

  const clinics = await prisma.clinic.findMany({
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
  });
  const horizon = new Date(now.getTime() + 8 * 86_400_000);
  summary.clinics.total = clinics.length;

  for (const row of clinics) {
    const clinic = toMessagingProfile(row);
    const cfg = clinic.notifications.whatsapp;
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
      const reminderHorizon = new Date(
        now.getTime() + (cfg.reminders.daysBefore + 2) * 86_400_000,
      );
      const reminderFloor = new Date(now.getTime() - 86_400_000);
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
            select: { status: true, createdAt: true },
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
export type ReminderDeliveryState =
  | { state: "scheduled"; sendAt: Date; channel: Channel }
  | { state: "sent"; at: Date; channel: Channel }
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
  | { state: "disabled" }
  | null;

export interface ReminderDeliveryRow {
  status: string;
  dueAt: Date;
  client: { phone: string | null; notificationsOptIn: boolean | null };
  pet?: { deceased: boolean; archivedAt: Date | null } | null;
  messages: { status: string; createdAt: Date; error: string | null; channel: Channel }[];
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
  const delivered = newestFirst.find((m) => m.status === "SENT" || m.status === "MANUAL");
  if (delivered)
    return { state: "sent", at: delivered.createdAt, channel: delivered.channel };

  const failures = newestFirst.filter((m) => m.status === "FAILED");
  if (failures.length > 0)
    return {
      state: "failed",
      at: failures[0].createdAt,
      error: failures[0].error,
      attempts: failures.length,
      // Derived here and not on the screen: the threshold is the sweep's
      // rule, and a copy of it in a component is a second place to
      // change when it moves.
      exhausted: failures.length >= MAX_AUTOMATIC_ATTEMPTS,
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
  // Clinic-wide reasons before per-client ones. With messaging switched
  // off every row is equally stuck, and telling the vet "this owner did
  // not consent" would send them to the wrong screen to fix it.
  if (!cfg.enabled || !cfg.reminders.enabled) return { state: "disabled" };
  const channel = clinic.notifications.channel;
  if (!isChannelConfigured(channel)) return { state: "notConfigured", channel };
  // Refused and never asked are one falsy value in code and two
  // different mornings for a vet: nothing to do about the first, a
  // phone call about the second. The column keeps them apart
  // (prisma/schema.prisma) and so must everything reading it.
  if (reminder.client.notificationsOptIn === false) return { state: "optedOut" };
  if (reminder.client.notificationsOptIn !== true) return { state: "neverAsked" };
  if (!normalizePhone(reminder.client.phone, countryCallingCode(clinic.country)))
    return { state: "noPhone" };

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

  const cfg = clinic.notifications.whatsapp;
  if (!cfg.enabled || !cfg.reminders.enabled)
    throw new AppError("VALIDATION_FAILED", "error.notifications.remindersDisabled");
  if (!isChannelConfigured(clinic.notifications.channel))
    throw new AppError("VALIDATION_FAILED", "error.notifications.notConfigured");
  if (reminder.pet && isPetSilenced(reminder.pet))
    throw new AppError("VALIDATION_FAILED", "error.notifications.petSilenced");
  if (!reminder.client.notificationsOptIn)
    throw new AppError("VALIDATION_FAILED", "error.notifications.optedOut");
  if (automaticSendBlock(reminder.messages, new Date()) === "alreadySent")
    throw new AppError("VALIDATION_FAILED", "error.notifications.alreadySent");

  const language = toMessageLocale(reminder.client.preferredLanguage);
  const recipient = normalizePhone(reminder.client.phone, countryCallingCode(clinic.country));
  if (!recipient) throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");

  const log = await deliver(
    clinic,
    {
      reminderId: reminder.id,
      clientId: reminder.client.id,
      kind: "REMINDER_DUE",
      recipient,
      language,
      body: composeReminderFor(clinic.notifications.channel, {
        locale: language,
        clientName: `${reminder.client.firstName} ${reminder.client.lastName}`.trim(),
        petName: reminder.pet?.name,
        type: reminder.type,
        title: reminder.title,
        body: reminder.body,
        dueAt: reminder.dueAt,
        clinic,
      }),
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
