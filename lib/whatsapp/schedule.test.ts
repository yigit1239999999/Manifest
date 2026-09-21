import { describe, expect, it } from "vitest";
import { isReminderDue, isReminderNoticeDue, reminderDueAt, reminderNoticeDueAt, zonedTimeToUtc } from "./schedule";

const TZ = "Europe/Istanbul"; // UTC+3, no DST
const startsAt = new Date("2026-09-20T11:30:00.000Z"); // 14:30 local

describe("zonedTimeToUtc", () => {
  it("converts clinic wall-clock time to an instant", () => {
    const d = zonedTimeToUtc({ year: 2026, month: 9, day: 20, hour: 9, minute: 0 }, TZ);
    expect(d.toISOString()).toBe("2026-09-20T06:00:00.000Z");
  });
});

describe("reminderDueAt", () => {
  it("is N hours before in hoursBefore mode", () => {
    const due = reminderDueAt(startsAt, { mode: "hoursBefore", hoursBefore: 3, morningHour: 9 }, TZ);
    expect(due?.toISOString()).toBe("2026-09-20T08:30:00.000Z");
  });

  it("is HH:00 clinic time on the day in morningOf mode", () => {
    const due = reminderDueAt(startsAt, { mode: "morningOf", hoursBefore: 3, morningHour: 9 }, TZ);
    expect(due?.toISOString()).toBe("2026-09-20T06:00:00.000Z");
  });

  it("is never due when off", () => {
    expect(reminderDueAt(startsAt, { mode: "off", hoursBefore: 3, morningHour: 9 }, TZ)).toBeNull();
  });
});

describe("isReminderDue", () => {
  const cfg = { mode: "hoursBefore" as const, hoursBefore: 2, morningHour: 9 };
  it("is false before the window, true inside it, false once the appointment started", () => {
    expect(isReminderDue(startsAt, new Date("2026-09-20T09:00:00.000Z"), cfg, TZ)).toBe(false);
    expect(isReminderDue(startsAt, new Date("2026-09-20T10:00:00.000Z"), cfg, TZ)).toBe(true);
    expect(isReminderDue(startsAt, new Date("2026-09-20T11:45:00.000Z"), cfg, TZ)).toBe(false);
  });
});

describe("reminder notices", () => {
  const dueAt = new Date("2026-10-01T09:00:00.000Z"); // 1 Oct, 12:00 local
  it("sends N days ahead at the morning hour", () => {
    expect(reminderNoticeDueAt(dueAt, 3, 9, TZ).toISOString()).toBe("2026-09-28T06:00:00.000Z");
  });
  it("is due from the send instant until the end of the due day", () => {
    expect(isReminderNoticeDue(dueAt, new Date("2026-09-28T05:00:00.000Z"), 3, 9, TZ)).toBe(false);
    expect(isReminderNoticeDue(dueAt, new Date("2026-09-28T06:00:00.000Z"), 3, 9, TZ)).toBe(true);
    expect(isReminderNoticeDue(dueAt, new Date("2026-10-01T20:00:00.000Z"), 3, 9, TZ)).toBe(true);
    expect(isReminderNoticeDue(dueAt, new Date("2026-10-02T00:00:00.000Z"), 3, 9, TZ)).toBe(false);
  });
});

// How often the sweep runs is part of whether a reminder is ever sent, and
// `vercel.json` is the only place that says so. A reminder is due inside a
// window that closes when the appointment starts, so a sweep that runs once
// a day can step straight over it.
describe("the cron cadence the schedule needs", () => {
  const cfg = { mode: "morningOf" as const, hoursBefore: 3, morningHour: 9 };

  /** The sweep instants a cron expression produces over one day, in UTC. */
  const sweeps = (hoursUtc: number[]) =>
    hoursUtc.map((h) => new Date(Date.UTC(2026, 8, 20, h, 0)));

  it("a daily 05:00 UTC sweep never catches a 09:00 clinic-time reminder", () => {
    // Due at 06:00 UTC (09:00 Istanbul), appointment starts 11:30 UTC. The
    // day's only run is at 05:00 UTC: an hour too early, and the next one is
    // a day too late.
    const caught = sweeps([5]).some((now) => isReminderDue(startsAt, now, cfg, TZ));
    expect(caught).toBe(false);
  });

  it("an hourly sweep catches it", () => {
    const caught = sweeps([...Array(24).keys()]).filter((now) =>
      isReminderDue(startsAt, now, cfg, TZ),
    );
    expect(caught.map((d) => d.getUTCHours())).toEqual([6, 7, 8, 9, 10, 11]);
  });

  // `vercel.json` is the backstop now, not the scheduler: the Hobby plan
  // allows nothing finer than daily, so the fifteen-minute caller is an
  // external service (DEPLOY.md). A once-a-day run has exactly one
  // chance to catch the morning reminder, which is why the hour is
  // checked against the due instant rather than against a string --
  // move it earlier and this fails with the reason, the way the two
  // tests above describe the failure it would cause.
  it("the daily backstop fires after the morning send, not before it", async () => {
    const { crons } = (await import("../../vercel.json")).default as {
      crons: { path: string; schedule: string }[];
    };
    const sweep = crons.find((c) => c.path === "/api/cron/reminders");
    expect(sweep?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);

    const [minute, hour] = (sweep?.schedule ?? "").split(" ").map(Number);
    const backstop = new Date(Date.UTC(2026, 8, 20, hour, minute));
    expect(isReminderDue(startsAt, backstop, cfg, TZ)).toBe(true);
  });
});
