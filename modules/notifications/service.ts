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
import { isReminderDue, isReminderNoticeDue } from "@/lib/whatsapp/schedule";
import { composeAppointmentFor, composeReminderFor } from "@/lib/messaging/compose";
import { getTransport, isChannelConfigured } from "@/lib/messaging/transports";
import { smsSegments } from "@/lib/messaging/sms/segments";
import type { Channel } from "@/lib/messaging/types";
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
    const message = error instanceof Error ? error.message : String(error);
    logger.error("notifications.send_failed", {
      channel,
      transport: transport.name,
      kind: target.kind,
      appointmentId: target.appointmentId,
      reminderId: target.reminderId,
      err: message,
    });
    await prisma.messageLog.create({
      data: { ...base, status: "FAILED", error: message.slice(0, 500) },
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

export interface SweepSummary {
  configured: boolean;
  clinics: number;
  appointments: { checked: number; sent: number; failed: number; notDue: number };
  reminders: { checked: number; sent: number; failed: number; notDue: number };
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
export function automaticSendBlocked(
  messages: { status: string; createdAt: Date }[],
  now: Date,
): boolean {
  if (messages.some((m) => m.status === "SENT" || m.status === "MANUAL")) return true;

  const failures = messages.filter((m) => m.status === "FAILED");
  if (failures.length >= MAX_AUTOMATIC_ATTEMPTS) return true;
  if (failures.length === 0) return false;

  const lastFailure = Math.max(...failures.map((m) => m.createdAt.getTime()));
  return now.getTime() - lastFailure < MIN_RETRY_INTERVAL_MS;
}

export async function runReminderSweep(now = new Date()): Promise<SweepSummary> {
  const summary: SweepSummary = {
    configured: false,
    clinics: 0,
    appointments: { checked: 0, sent: 0, failed: 0, notDue: 0 },
    reminders: { checked: 0, sent: 0, failed: 0, notDue: 0 },
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

  for (const row of clinics) {
    const clinic = toMessagingProfile(row);
    const cfg = clinic.notifications.whatsapp;
    if (!cfg.enabled) continue;
    if (!isChannelConfigured(clinic.notifications.channel)) continue;
    summary.configured = true;
    summary.clinics++;

    if (cfg.reminder.mode !== "off") {
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
      for (const appointment of candidates) {
        if (automaticSendBlocked(appointment.messages, now)) continue;
        summary.appointments.checked++;
        if (!isReminderDue(appointment.startsAt, now, cfg.reminder, clinic.timezone)) {
          summary.appointments.notDue++;
          continue;
        }
        try {
          await deliver(clinic, appointmentTarget(appointment, "APPOINTMENT_REMINDER", clinic), null);
          summary.appointments.sent++;
        } catch {
          summary.appointments.failed++;
        }
      }
    }

    if (cfg.reminders.enabled) {
      const reminderHorizon = new Date(
        now.getTime() + (cfg.reminders.daysBefore + 2) * 86_400_000,
      );
      const reminders = await prisma.reminder.findMany({
        where: {
          clinicId: clinic.id,
          status: "PENDING",
          dueAt: { gte: new Date(now.getTime() - 86_400_000), lte: reminderHorizon },
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
      for (const reminder of reminders) {
        if (automaticSendBlocked(reminder.messages, now)) continue;
        summary.reminders.checked++;
        if (
          !isReminderNoticeDue(
            reminder.dueAt,
            now,
            cfg.reminders.daysBefore,
            cfg.reminder.morningHour,
            clinic.timezone,
          )
        ) {
          summary.reminders.notDue++;
          continue;
        }
        const language = toMessageLocale(reminder.client.preferredLanguage);
        const recipient = normalizePhone(reminder.client.phone, countryCallingCode(clinic.country));
        if (!recipient) continue;
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
          summary.reminders.sent++;
        } catch {
          summary.reminders.failed++;
        }
      }
    }
  }
  return summary;
}
