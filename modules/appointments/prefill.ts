import { dayKey, isDayKey, shiftDayKey, wallTimeToInstant } from "@/lib/format";
import { VISIT_TYPES } from "@/modules/appointments/schema";

type VisitType = (typeof VISIT_TYPES)[number];

/**
 * The hours a suggested start may fall in, on the clinic's clock.
 *
 * Clinics do not record opening hours yet, so these are a default and
 * not a rule: the vet can still type 21:00. They only decide what the
 * field opens on, which used to be "an hour from now" whatever the hour
 * was -- at 21:50 that booked the animal in after closing.
 */
export const DAY_OPENS = "09:00";
export const DAY_CLOSES = "19:00";

/** Longest `reason` a link may carry; the field itself takes 500. */
export const PREFILL_REASON_MAX = 200;

export interface AppointmentPrefill {
  type?: VisitType;
  reason?: string;
  /** "YYYY-MM-DD", a real calendar day. */
  date?: string;
}

/**
 * What a link into `/appointments/new` asked for, with anything that
 * is not usable dropped rather than refused: a stale or hand-edited
 * link still opens the form, only with less filled in.
 */
export function parseAppointmentPrefill(params: {
  type?: string | string[];
  reason?: string | string[];
  date?: string | string[];
}): AppointmentPrefill {
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const type = VISIT_TYPES.find((v) => v === one(params.type));
  const reason = one(params.reason)?.trim().slice(0, PREFILL_REASON_MAX).trim();
  const date = one(params.date);
  return {
    type,
    reason: reason || undefined,
    date: isRealDay(date) ? date : undefined,
  };
}

/** "2026-02-31" passes the shape check and is not a day. */
function isRealDay(value: unknown): value is string {
  return isDayKey(value) && shiftDayKey(value, 0) === value;
}

/**
 * Where a new appointment's start field opens.
 *
 * - A day in the future: that day, at opening time. The link came from
 *   something due that day (a vaccine, a check-up), and the hour is the
 *   one thing it cannot know.
 * - Otherwise (no day, today, or a day already gone): an hour from now,
 *   moved into opening hours if it falls outside them -- before opening
 *   is that morning, after closing is the next morning.
 *
 * Every hour here is the clinic's, through the same conversion the
 * field itself submits with (`wallTimeToInstant`, `DateTimeInput`), so
 * "09:00" is nine o'clock where the animal is, not on the server.
 */
export function defaultAppointmentStart({
  now,
  date,
  timeZone,
}: {
  now: Date;
  date?: string;
  timeZone?: string;
}): Date {
  const today = dayKey(now, timeZone);
  if (isRealDay(date) && date > today) return clinicTime(date, DAY_OPENS, timeZone);

  // Rounded up to the quarter hour (pm B4): nobody books 10:37, and a
  // field that opens on it has to be corrected every time. On the
  // instant rather than the wall clock, which is the same thing for
  // every zone whose offset is a whole number of quarter hours -- all
  // of them in use.
  const inAnHour = roundUpToQuarter(new Date(now.getTime() + 3600 * 1000));
  const day = dayKey(inAnHour, timeZone);
  const opens = clinicTime(day, DAY_OPENS, timeZone);
  if (inAnHour < opens) return opens;
  if (inAnHour >= clinicTime(day, DAY_CLOSES, timeZone))
    return clinicTime(shiftDayKey(day, 1), DAY_OPENS, timeZone);
  return inAnHour;
}

const QUARTER_MS = 15 * 60 * 1000;

/** The next quarter-hour mark at or after `date`, seconds dropped. */
export function roundUpToQuarter(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / QUARTER_MS) * QUARTER_MS);
}

function clinicTime(day: string, time: string, timeZone?: string): Date {
  const instant = wallTimeToInstant(`${day}T${time}`, timeZone);
  // Unreachable: every key here came from `dayKey` or `isRealDay`.
  if (!instant) throw new Error(`Not a day: ${day}`);
  return instant;
}

/**
 * A link into `/appointments/new` that says what the booking is for.
 *
 * Every "Book" on the dashboard and the reminders list used to open a
 * blank "general check-up" an hour from now, for a call that was about
 * one vaccine on one day.
 */
export function newAppointmentHref({
  petId,
  type,
  reason,
  date,
}: { petId: string } & AppointmentPrefill): string {
  const query = new URLSearchParams({ petId });
  if (type) query.set("type", type);
  const trimmed = reason?.trim().slice(0, PREFILL_REASON_MAX).trim();
  if (trimmed) query.set("reason", trimmed);
  if (date) query.set("date", date);
  return `/appointments/new?${query.toString()}`;
}

/**
 * The kind of visit a reminder is asking for, where one follows from it.
 * A birthday or a custom reminder says nothing about the visit, so the
 * form keeps its own default there.
 */
const VISIT_TYPE_FOR_REMINDER: Partial<Record<string, VisitType>> = {
  VACCINATION_DUE: "VACCINATION",
  CHECKUP: "WELLNESS_CHECK",
  FOLLOWUP: "FOLLOWUP",
};

/**
 * "Book" from a reminder row: for the animal, about what the reminder
 * says, and on the day it falls due when that day is still ahead. A
 * reminder already due books the next open slot instead, like an
 * overdue vaccination does.
 */
export function reminderBookingHref(
  reminder: { type: string; title: string; dueAt: Date; petId: string },
  { now, timeZone }: { now: Date; timeZone?: string },
): string {
  return newAppointmentHref({
    petId: reminder.petId,
    type: VISIT_TYPE_FOR_REMINDER[reminder.type],
    reason: reminder.title,
    date:
      reminder.dueAt.getTime() > now.getTime()
        ? dayKey(reminder.dueAt, timeZone)
        : undefined,
  });
}
