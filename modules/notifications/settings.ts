// Per-clinic notification preferences, stored in `Clinic.settings.notifications`.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ReminderConfig, ReminderMode } from "@/lib/whatsapp/schedule";
import type { Channel } from "@/lib/messaging/types";

export interface NotificationSettings {
  /** Delivery channel for every automatic message. */
  channel: Channel;
  whatsapp: {
    /**
     * `null` means nobody has ever opened the settings for this
     * clinic; `false` means somebody did and switched it off.
     *
     * Two different things that were one value. A clinic that has
     * never been set up is not a clinic that decided against
     * messaging, and the sentence a screen should show is different
     * for each: "turn it on" versus "you turned it off". Everything
     * that merely asks "may I send" keeps working unchanged, because
     * `null` is falsy.
     *
     * No migration and no back-filled guess: the distinction was
     * already in the data and this parser was discarding it. Measured
     * when this was written -- 180 clinics with no notifications
     * block at all, 3 with one, and not a single explicit `false`.
     */
    enabled: boolean | null;
    confirmOnBooking: boolean;
    reminder: ReminderConfig;
    /** Pet reminders (vaccination due, check-up, ...) sent N days ahead. */
    reminders: { enabled: boolean; daysBefore: number };
  };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channel: "SMS",
  whatsapp: {
    // Not `false`: nobody has said anything yet. See the field.
    enabled: null,
    confirmOnBooking: true,
    reminder: { mode: "morningOf", hoursBefore: 3, morningHour: 9 },
    reminders: { enabled: true, daysBefore: 3 },
  },
};

const MODES: ReadonlySet<string> = new Set<ReminderMode>(["off", "hoursBefore", "morningOf"]);

export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const d = DEFAULT_NOTIFICATION_SETTINGS.whatsapp;
  const src =
    raw && typeof raw === "object" && "whatsapp" in raw
      ? ((raw as { whatsapp?: Record<string, unknown> }).whatsapp ?? {})
      : {};
  const reminder = (src.reminder ?? {}) as Record<string, unknown>;
  const reminders = (src.reminders ?? {}) as Record<string, unknown>;
  const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const channelRaw =
    raw && typeof raw === "object" && "channel" in raw ? (raw as { channel?: unknown }).channel : undefined;
  return {
    channel: channelRaw === "WHATSAPP" ? "WHATSAPP" : "SMS",
    whatsapp: {
      // The absence of the key is the answer, not a reason to invent
      // one -- it is how "never set up" is recorded, and it has been
      // all along.
      enabled: typeof src.enabled === "boolean" ? src.enabled : d.enabled,
      confirmOnBooking:
        typeof src.confirmOnBooking === "boolean" ? src.confirmOnBooking : d.confirmOnBooking,
      reminder: {
        mode: MODES.has(String(reminder.mode)) ? (reminder.mode as ReminderMode) : d.reminder.mode,
        hoursBefore: clampInt(reminder.hoursBefore, 1, 168, d.reminder.hoursBefore),
        morningHour: clampInt(reminder.morningHour, 0, 23, d.reminder.morningHour),
      },
      reminders: {
        enabled: typeof reminders.enabled === "boolean" ? reminders.enabled : d.reminders.enabled,
        daysBefore: clampInt(reminders.daysBefore, 0, 60, d.reminders.daysBefore),
      },
    },
  };
}

export interface ClinicMessagingProfile {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  country: string | null;
  notifications: NotificationSettings;
}

function joinAddress(parts: (string | null)[]): string | null {
  const s = parts.filter((p) => p && p.trim()).join(", ");
  return s || null;
}

export function toMessagingProfile(clinic: {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  settings: unknown;
}): ClinicMessagingProfile {
  const settings = (clinic.settings ?? {}) as { notifications?: unknown };
  return {
    id: clinic.id,
    name: clinic.name,
    phone: clinic.phone,
    address: joinAddress([clinic.address, clinic.city]),
    timezone: clinic.timezone || "UTC",
    country: clinic.country,
    notifications: parseNotificationSettings(settings.notifications),
  };
}

export const getClinicMessagingProfile = cache(
  async (clinicId: string): Promise<ClinicMessagingProfile | null> => {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
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
    return clinic ? toMessagingProfile(clinic) : null;
  },
);

/** Default country calling code for local phone numbers, by clinic country. */
export function countryCallingCode(country: string | null): string {
  const c = (country ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    TR: "90", TÜRKIYE: "90", TURKEY: "90", TÜRKİYE: "90",
    GB: "44", UK: "44", DE: "49", NL: "31", FR: "33", US: "1", AE: "971", AZ: "994",
  };
  return map[c] ?? "90";
}
