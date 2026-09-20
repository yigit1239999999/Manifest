import { prisma } from "@/lib/prisma";
import { AppError, notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import {
  normalizePhone,
  toMessageLocale,
  visitTypeLabel,
  whatsappLink,
  type AppointmentMessageKind,
} from "@/lib/whatsapp/messages";
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
  pet: { select: { name: true } },
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
  if (!appointment.client.notificationsOptIn)
    throw new AppError("VALIDATION_FAILED", "error.notifications.optedOut");
  return deliver(clinic, appointmentTarget(appointment, kind, clinic), ctx.userId);
}

/** Staff opened the message in WhatsApp themselves; keep the trail. */
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
  const composed = composeFor(appointment, kind, clinic, "WHATSAPP");
  if (!composed.recipient) throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");
  return prisma.messageLog.create({
    data: {
      clinicId: clinic.id,
      appointmentId: appointment.id,
      clientId: appointment.client.id,
      channel: "WHATSAPP",
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

/** Idempotent: SENT/MANUAL logs block resends; FAILED ones allow a few retries. */
export function attemptsExhausted(messages: { status: string }[]): boolean {
  if (messages.some((m) => m.status === "SENT" || m.status === "MANUAL")) return true;
  return messages.filter((m) => m.status === "FAILED").length >= MAX_AUTOMATIC_ATTEMPTS;
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
        },
        include: {
          ...APPOINTMENT_INCLUDE,
          messages: { where: { kind: "APPOINTMENT_REMINDER" }, select: { status: true } },
        },
      });
      for (const appointment of candidates) {
        if (attemptsExhausted(appointment.messages)) continue;
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
        },
        include: {
          pet: { select: { name: true } },
          client: { select: CLIENT_SELECT },
          messages: { where: { kind: "REMINDER_DUE" }, select: { status: true } },
        },
      });
      for (const reminder of reminders) {
        if (attemptsExhausted(reminder.messages)) continue;
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
