// When is an appointment reminder due?
//
// Two clinic-configurable modes:
// - hoursBefore: N hours before the appointment.
// - morningOf: at HH:00 (clinic time) on the day of the appointment.
// Pure date math, timezone-aware via Intl, no dependencies.

export type ReminderMode = "off" | "hoursBefore" | "morningOf";

export interface ReminderConfig {
  mode: ReminderMode;
  hoursBefore: number;
  morningHour: number;
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function zonedParts(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** The UTC instant for a wall-clock time in `timeZone`. */
export function zonedTimeToUtc(
  { year, month, day, hour, minute }: Parts,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes handle DST edges: shift by the observed offset, re-check.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = asUtc - Date.UTC(year, month - 1, day, hour, minute);
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

export function reminderDueAt(
  startsAt: Date,
  cfg: ReminderConfig,
  timeZone: string,
): Date | null {
  if (cfg.mode === "hoursBefore") {
    return new Date(startsAt.getTime() - cfg.hoursBefore * 3_600_000);
  }
  if (cfg.mode === "morningOf") {
    const p = zonedParts(startsAt, timeZone);
    return zonedTimeToUtc({ ...p, hour: cfg.morningHour, minute: 0 }, timeZone);
  }
  return null;
}

/** Due once we've passed the due instant and the appointment hasn't started. */
export function isReminderDue(
  startsAt: Date,
  now: Date,
  cfg: ReminderConfig,
  timeZone: string,
): boolean {
  const due = reminderDueAt(startsAt, cfg, timeZone);
  if (!due) return false;
  return now.getTime() >= due.getTime() && now.getTime() < startsAt.getTime();
}

/**
 * When to send a reminder-due notice: `daysBefore` days ahead of the due
 * date, at `morningHour` clinic time. Stays due until the end of the due day.
 */
export function reminderNoticeDueAt(
  dueAt: Date,
  daysBefore: number,
  morningHour: number,
  timeZone: string,
): Date {
  const p = zonedParts(dueAt, timeZone);
  const onDueDay = zonedTimeToUtc({ ...p, hour: morningHour, minute: 0 }, timeZone);
  return new Date(onDueDay.getTime() - daysBefore * 86_400_000);
}

export function isReminderNoticeDue(
  dueAt: Date,
  now: Date,
  daysBefore: number,
  morningHour: number,
  timeZone: string,
): boolean {
  const sendAt = reminderNoticeDueAt(dueAt, daysBefore, morningHour, timeZone);
  const p = zonedParts(dueAt, timeZone);
  const endOfDueDay = new Date(
    zonedTimeToUtc({ ...p, hour: 0, minute: 0 }, timeZone).getTime() + 86_400_000,
  );
  return now.getTime() >= sendAt.getTime() && now.getTime() < endOfDueDay.getTime();
}
