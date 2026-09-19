import { prisma } from "@/lib/prisma";
import { AppError, notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import {
  composeAppointmentMessage,
  composeReminderMessage,
  normalizePhone,
  toMessageLocale,
  visitTypeLabel,
  whatsappLink,
  type AppointmentMessageKind,
} from "@/lib/whatsapp/messages";
import { isReminderDue, isReminderNoticeDue } from "@/lib/whatsapp/schedule";
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/whatsapp/provider";
import { TIMEZONES, type NotificationSettingsInput } from "./schema";
import {
  countryCallingCode,
  getClinicMessagingProfile,
  parseNotificationSettings,
  toMessagingProfile,
  type ClinicMessagingProfile,
} from "./settings";

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

const APPOINTMENT_INCLUDE = {
  pet: { select: { name: true } },
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      preferredLanguage: true,
      whatsappOptIn: true,
    },
  },
  vet: { select: { name: true } },
} as const;

type LoadedAppointment = NonNullable<
  Awaited<ReturnType<typeof loadAppointment>>
>;

async function loadAppointment(clinicId: string, id: string) {
  return prisma.appointment.findFirst({
    where: { id, clinicId },
    include: APPOINTMENT_INCLUDE,
  });
}

export interface ComposedMessage {
  kind: AppointmentMessageKind;
  language: "tr" | "en";
  recipient: string | null;
  body: string;
  link: string | null;
}

export function composeFor(
  appointment: LoadedAppointment,
  kind: AppointmentMessageKind,
  clinic: ClinicMessagingProfile,
  now?: Date,
): ComposedMessage {
  const language = toMessageLocale(appointment.client.preferredLanguage);
  const recipient = normalizePhone(appointment.client.phone, countryCallingCode(clinic.country));
  const body = composeAppointmentMessage(kind, {
    locale: language,
    clientName: `${appointment.client.firstName} ${appointment.client.lastName}`.trim(),
    petName: appointment.pet.name,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    visitType: visitTypeLabel(appointment.type, language),
    vetName: appointment.vet?.name,
    clinic,
    now,
  });
  return {
    kind,
    language,
    recipient,
    body,
    link: recipient ? whatsappLink(recipient, body) : null,
  };
}

/** Both messages for an appointment, ready for the appointment page. */
export async function previewAppointmentMessages(clinicId: string, appointmentId: string) {
  const [appointment, clinic] = await Promise.all([
    loadAppointment(clinicId, appointmentId),
    getClinicMessagingProfile(clinicId),
  ]);
  if (!appointment || !clinic) return null;
  return {
    confirmation: composeFor(appointment, "APPOINTMENT_CONFIRMATION", clinic),
    reminder: composeFor(appointment, "APPOINTMENT_REMINDER", clinic),
    configured: isWhatsAppConfigured(),
    optedIn: appointment.client.whatsappOptIn,
  };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function deliver(
  appointment: LoadedAppointment,
  kind: AppointmentMessageKind,
  clinic: ClinicMessagingProfile,
  actorId: string | null,
) {
  const composed = composeFor(appointment, kind, clinic);
  if (!composed.recipient) {
    throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");
  }
  if (!appointment.client.whatsappOptIn) {
    throw new AppError("VALIDATION_FAILED", "error.notifications.optedOut");
  }
  if (!isWhatsAppConfigured()) {
    throw new AppError("VALIDATION_FAILED", "error.notifications.notConfigured");
  }
  try {
    const { id } = await sendWhatsAppText(composed.recipient, composed.body);
    const log = await prisma.messageLog.create({
      data: {
        clinicId: clinic.id,
        appointmentId: appointment.id,
        clientId: appointment.client.id,
        kind,
        recipient: composed.recipient,
        language: composed.language,
        body: composed.body,
        status: "SENT",
        providerId: id || null,
      },
    });
    await writeAudit({
      clinicId: clinic.id,
      actorId,
      action: "CREATE",
      entityType: "MessageLog",
      entityId: log.id,
      metadata: { kind, status: "SENT" },
    });
    return log;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("whatsapp.send_failed", { appointmentId: appointment.id, kind, err: message });
    await prisma.messageLog.create({
      data: {
        clinicId: clinic.id,
        appointmentId: appointment.id,
        clientId: appointment.client.id,
        kind,
        recipient: composed.recipient,
        language: composed.language,
        body: composed.body,
        status: "FAILED",
        error: message.slice(0, 500),
      },
    });
    throw new AppError("VALIDATION_FAILED", "error.notifications.sendFailed");
  }
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
  return deliver(appointment, kind, clinic, ctx.userId);
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
  const composed = composeFor(appointment, kind, clinic);
  if (!composed.recipient)
    throw new AppError("VALIDATION_FAILED", "error.notifications.noPhone");
  return prisma.messageLog.create({
    data: {
      clinicId: clinic.id,
      appointmentId: appointment.id,
      clientId: appointment.client.id,
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
    if (!isWhatsAppConfigured()) return;
    const appointment = await loadAppointment(ctx.clinicId, appointmentId);
    if (!appointment || !appointment.client.phone || !appointment.client.whatsappOptIn) return;
    await deliver(appointment, "APPOINTMENT_CONFIRMATION", clinic, ctx.userId);
  } catch (error) {
    logger.warn("whatsapp.confirmation_skipped", {
      appointmentId,
      err: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Reminder sweep (cron)
// ---------------------------------------------------------------------------

export async function runReminderSweep(now = new Date()) {
  const summary = {
    clinics: 0,
    checked: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    remindersChecked: 0,
    remindersSent: 0,
    remindersFailed: 0,
  };
  if (!isWhatsAppConfigured()) return { ...summary, configured: false };

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
    summary.clinics++;

    if (cfg.reminder.mode !== "off") {
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId: clinic.id,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          startsAt: { gt: now, lte: horizon },
          client: { archivedAt: null, phone: { not: null }, whatsappOptIn: true },
          messages: { none: { kind: "APPOINTMENT_REMINDER" } },
        },
        include: APPOINTMENT_INCLUDE,
      });
      for (const appointment of candidates) {
        summary.checked++;
        if (!isReminderDue(appointment.startsAt, now, cfg.reminder, clinic.timezone)) {
          summary.skipped++;
          continue;
        }
        try {
          await deliver(appointment, "APPOINTMENT_REMINDER", clinic, null);
          summary.sent++;
        } catch {
          summary.failed++;
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
          client: { archivedAt: null, phone: { not: null }, whatsappOptIn: true },
          messages: { none: { kind: "REMINDER_DUE" } },
        },
        include: {
          pet: { select: { name: true } },
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, preferredLanguage: true },
          },
        },
      });
      for (const reminder of reminders) {
        summary.remindersChecked++;
        if (
          !isReminderNoticeDue(
            reminder.dueAt,
            now,
            cfg.reminders.daysBefore,
            cfg.reminder.morningHour,
            clinic.timezone,
          )
        )
          continue;
        const language = toMessageLocale(reminder.client.preferredLanguage);
        const recipient = normalizePhone(reminder.client.phone, countryCallingCode(clinic.country));
        if (!recipient) continue;
        const body = composeReminderMessage({
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
          const { id } = await sendWhatsAppText(recipient, body);
          await prisma.$transaction([
            prisma.messageLog.create({
              data: {
                clinicId: clinic.id,
                reminderId: reminder.id,
                clientId: reminder.client.id,
                kind: "REMINDER_DUE",
                recipient,
                language,
                body,
                status: "SENT",
                providerId: id || null,
              },
            }),
            prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: "SENT", sentAt: now },
            }),
          ]);
          summary.remindersSent++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error("whatsapp.reminder_failed", { reminderId: reminder.id, err: message });
          await prisma.messageLog.create({
            data: {
              clinicId: clinic.id,
              reminderId: reminder.id,
              clientId: reminder.client.id,
              kind: "REMINDER_DUE",
              recipient,
              language,
              body,
              status: "FAILED",
              error: message.slice(0, 500),
            },
          });
          summary.remindersFailed++;
        }
      }
    }
  }
  return { ...summary, configured: true };
}
