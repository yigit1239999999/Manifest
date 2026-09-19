import { z } from "zod";
import { checkbox, optionalInt, requiredEnum, requiredText } from "@/lib/forms";

export const REMINDER_MODES = ["off", "hoursBefore", "morningOf"] as const;
export const CHANNELS = ["SMS", "WHATSAPP"] as const;

export const TIMEZONES = [
  "Europe/Istanbul",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Asia/Baku",
  "Asia/Dubai",
  "America/New_York",
  "America/Los_Angeles",
] as const;

export const notificationSettingsSchema = z.object({
  channel: requiredEnum(CHANNELS),
  enabled: checkbox,
  confirmOnBooking: checkbox,
  reminderMode: requiredEnum(REMINDER_MODES),
  hoursBefore: optionalInt({ min: 1, max: 168 }),
  morningHour: optionalInt({ min: 0, max: 23 }),
  remindersEnabled: checkbox,
  remindersDaysBefore: optionalInt({ min: 0, max: 60 }),
  timezone: requiredText(1, 64, "Saat dilimi"),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
