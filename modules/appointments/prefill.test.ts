import { describe, expect, it } from "vitest";
import {
  defaultAppointmentStart,
  roundUpToQuarter,
  newAppointmentHref,
  parseAppointmentPrefill,
  reminderBookingHref,
} from "@/modules/appointments/prefill";

const IST = "Europe/Istanbul"; // UTC+3 all year

describe("defaultAppointmentStart", () => {
  it("is an hour from now inside opening hours, on the clinic's clock", () => {
    // 14:30 in Istanbul: already on a quarter.
    const now = new Date("2026-10-04T11:30:00Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-04T12:30:00.000Z",
    );
  });

  // pm B4: the field opened on 15:37 and had to be corrected every time.
  it("rounds up to the next quarter hour", () => {
    // 14:20:41 in Istanbul -> 15:20:41 -> 15:30.
    const now = new Date("2026-10-04T11:20:41Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-04T12:30:00.000Z",
    );
  });

  it("moves a late-evening suggestion to the next morning at 09:00", () => {
    // 21:50 in Istanbul: an hour from now is 22:50, after closing.
    const now = new Date("2026-10-04T18:50:00Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-05T06:00:00.000Z",
    );
  });

  it("treats 19:00 as closed", () => {
    // 18:00 in Istanbul: an hour from now is exactly 19:00.
    const now = new Date("2026-10-04T15:00:00Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-05T06:00:00.000Z",
    );
  });

  it("moves an early-morning suggestion to 09:00 the same day", () => {
    // 06:30 in Istanbul.
    const now = new Date("2026-10-04T03:30:00Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-04T06:00:00.000Z",
    );
  });

  it("uses the clinic's day, not UTC's, past midnight", () => {
    // 23:30 in Istanbul (20:30 UTC, still "today" in UTC): the next
    // morning is the 5th in Istanbul.
    const now = new Date("2026-10-04T20:30:00Z");
    expect(defaultAppointmentStart({ now, timeZone: IST }).toISOString()).toBe(
      "2026-10-05T06:00:00.000Z",
    );
  });

  it("opens a future day at 09:00 clinic time", () => {
    const now = new Date("2026-10-04T18:50:00Z");
    expect(
      defaultAppointmentStart({ now, date: "2026-10-12", timeZone: IST }).toISOString(),
    ).toBe("2026-10-12T06:00:00.000Z");
  });

  it("follows daylight saving in a zone that has it", () => {
    // New York is UTC-4 in October and UTC-5 in December.
    const now = new Date("2026-10-04T15:00:00Z");
    expect(
      defaultAppointmentStart({
        now,
        date: "2026-12-01",
        timeZone: "America/New_York",
      }).toISOString(),
    ).toBe("2026-12-01T14:00:00.000Z");
  });

  it("treats today, a past day or a non-day like no day at all", () => {
    const now = new Date("2026-10-04T18:50:00Z"); // 21:50 Istanbul
    const next = "2026-10-05T06:00:00.000Z";
    for (const date of ["2026-10-04", "2026-09-01", "2026-02-31", "soon"]) {
      expect(
        defaultAppointmentStart({ now, date, timeZone: IST }).toISOString(),
      ).toBe(next);
    }
  });
});

describe("parseAppointmentPrefill", () => {
  it("keeps a known type, a trimmed reason and a real day", () => {
    expect(
      parseAppointmentPrefill({
        type: "VACCINATION",
        reason: "  Kuduz  ",
        date: "2026-10-12",
      }),
    ).toEqual({ type: "VACCINATION", reason: "Kuduz", date: "2026-10-12" });
  });

  it("drops what it cannot use", () => {
    expect(
      parseAppointmentPrefill({ type: "vaccination", reason: "   ", date: "2026-02-31" }),
    ).toEqual({ type: undefined, reason: undefined, date: undefined });
  });

  it("caps the reason at 200 characters", () => {
    expect(parseAppointmentPrefill({ reason: "a".repeat(300) }).reason).toHaveLength(200);
  });

  it("reads the first of a repeated parameter", () => {
    expect(parseAppointmentPrefill({ type: ["SURGERY", "DENTAL"] }).type).toBe("SURGERY");
  });
});

describe("newAppointmentHref", () => {
  it("carries only what was given, encoded", () => {
    expect(newAppointmentHref({ petId: "p1" })).toBe("/appointments/new?petId=p1");
    const href = newAppointmentHref({
      petId: "p1",
      type: "VACCINATION",
      reason: "Karma aşı & kuduz",
      date: "2026-10-12",
    });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/appointments/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      petId: "p1",
      type: "VACCINATION",
      reason: "Karma aşı & kuduz",
      date: "2026-10-12",
    });
  });

  it("round-trips through the parser", () => {
    const href = newAppointmentHref({ petId: "p1", type: "FOLLOWUP", reason: "Dikiş kontrolü" });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseAppointmentPrefill(params)).toEqual({
      type: "FOLLOWUP",
      reason: "Dikiş kontrolü",
      date: undefined,
    });
  });
});

describe("reminderBookingHref", () => {
  const params = (href: string) =>
    Object.fromEntries(new URL(href, "http://x").searchParams);
  // 21:50 in Istanbul on 4 October.
  const now = new Date("2026-10-04T18:50:00Z");

  it("books a vaccination reminder as a vaccination, on its day", () => {
    // Due on the 12th: stored as midnight on the clinic's clock.
    const href = reminderBookingHref(
      {
        petId: "p1",
        type: "VACCINATION_DUE",
        title: "Kuduz aşısı",
        dueAt: new Date("2026-10-11T21:00:00Z"),
      },
      { now, timeZone: IST },
    );
    expect(params(href)).toEqual({
      petId: "p1",
      type: "VACCINATION",
      reason: "Kuduz aşısı",
      date: "2026-10-12",
    });
  });

  it("leaves the day out once the reminder is due", () => {
    const href = reminderBookingHref(
      {
        petId: "p1",
        type: "VACCINATION_DUE",
        title: "Karma aşı",
        dueAt: new Date("2026-10-03T21:00:00Z"),
      },
      { now, timeZone: IST },
    );
    expect(params(href).date).toBeUndefined();
  });

  it("names no type for a reminder that does not imply one", () => {
    const href = reminderBookingHref(
      {
        petId: "p1",
        type: "CUSTOM",
        title: "Mama siparişi",
        dueAt: new Date("2026-10-20T21:00:00Z"),
      },
      { now, timeZone: IST },
    );
    expect(params(href)).toEqual({
      petId: "p1",
      reason: "Mama siparişi",
      date: "2026-10-21",
    });
  });
});

describe("roundUpToQuarter", () => {
  it("keeps a quarter as it is and drops seconds otherwise", () => {
    expect(roundUpToQuarter(new Date("2026-10-04T12:45:00Z")).toISOString()).toBe(
      "2026-10-04T12:45:00.000Z",
    );
    expect(roundUpToQuarter(new Date("2026-10-04T12:45:01Z")).toISOString()).toBe(
      "2026-10-04T13:00:00.000Z",
    );
  });
});
