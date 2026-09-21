import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    appointment: { findFirst: vi.fn(), findMany: vi.fn() },
    reminder: { findMany: vi.fn(), update: vi.fn() },
    messageLog: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const transport = {
  channel: "SMS" as const,
  name: "netgsm",
  isConfigured: vi.fn(() => true),
  send: vi.fn(),
};
vi.mock("@/lib/messaging/transports", () => ({
  getTransport: vi.fn(() => transport),
  isChannelConfigured: vi.fn(() => true),
  transportName: vi.fn(() => "netgsm"),
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  automaticSendBlocked,
  notifyAppointmentBooked,
  runReminderSweep,
  logManualMessage,
  previewAppointmentMessages,
  sendAppointmentMessage,
} from "./service";
import { parseNotificationSettings } from "./settings";

const ctx = { clinicId: "clinic-1", userId: "u-1", userName: "Vet", userRole: "ADMIN" };

const clinicRow = {
  id: "clinic-1",
  name: "Yiğit Klinik",
  phone: "0212 555 00 00",
  address: "Kadıköy",
  city: "İstanbul",
  country: "TR",
  timezone: "Europe/Istanbul",
  settings: { notifications: { channel: "SMS", whatsapp: { enabled: true } } },
};

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    status: "SCHEDULED",
    startsAt: new Date("2026-09-20T11:30:00.000Z"),
    durationMinutes: 30,
    type: "VACCINATION",
    pet: { name: "Sarı", deceased: false, archivedAt: null },
    client: {
      id: "c-1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      phone: "0532 123 45 67",
      preferredLanguage: "tr",
      notificationsOptIn: true,
    },
    vet: { name: "Dr. Kaya" },
    ...overrides,
  };
}

// The fixture appointment is at a fixed instant, and half of what the
// service decides now depends on whether that instant has gone by. Pinning
// the clock two hours before it keeps "this appointment is still ahead"
// true for good, instead of for as long as the suite is run before
// 20 September 2026 — a test that starts failing on a calendar date is
// worse than no test.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T09:30:00.000Z"));
  vi.mocked(prisma.clinic.findUnique).mockResolvedValue(clinicRow as never);
  vi.mocked(prisma.messageLog.create).mockImplementation((async (args: { data: Record<string, unknown> }) => ({
    id: "m-1",
    ...args.data,
  })) as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendAppointmentMessage", () => {
  it("sends a short SMS to the normalized number and logs it as SENT", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appointment() as never);
    transport.send.mockResolvedValue({ providerId: "job-42" });

    const log = await sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx);

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "905321234567", language: "tr" }),
    );
    const body = transport.send.mock.calls[0][0].body as string;
    expect(body).toContain("Sayın Ayşe Yılmaz, Sarı için 20 Eyl Paz 14:30 randevunuz oluşturulmuştur.");
    expect(log).toMatchObject({ status: "SENT", channel: "SMS", providerId: "job-42" });
  });

  it("refuses when the client opted out of notifications", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ client: { ...appointment().client, notificationsOptIn: false } }) as never,
    );
    await expect(sendAppointmentMessage("a-1", "APPOINTMENT_REMINDER", ctx)).rejects.toMatchObject({
      messageKey: "error.notifications.optedOut",
    });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("logs a FAILED row and surfaces a user-facing error when the provider rejects", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appointment() as never);
    transport.send.mockRejectedValue(new Error("sender_title_not_registered"));

    await expect(sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", error: "sender_title_not_registered" }),
    });
  });

  // A cancelled, missed or finished appointment has no true confirmation
  // and no reminder worth sending; one wrong message costs the clinic more
  // than a missing one.
  it.each(["CANCELLED", "NO_SHOW", "COMPLETED"])(
    "refuses to send for a %s appointment",
    async (status) => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
        appointment({ status }) as never,
      );
      await expect(
        sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx),
      ).rejects.toMatchObject({
        messageKey: "error.notifications.appointmentClosed",
      });
      expect(transport.send).not.toHaveBeenCalled();
    },
  );

  it("still sends for an appointment that is going ahead", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "CONFIRMED" }) as never,
    );
    transport.send.mockResolvedValue({ providerId: "job-43" });

    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_REMINDER", ctx),
    ).resolves.toMatchObject({ status: "SENT" });
  });

  // Recording a manual send claims the message went out; it must not be
  // possible for one the app itself would refuse.
  it("refuses to log a manual send for a closed appointment", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "CANCELLED" }) as never,
    );
    await expect(
      logManualMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx),
    ).rejects.toMatchObject({
      messageKey: "error.notifications.appointmentClosed",
    });
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
  });

  // Backlog 42a. The status list closed the cancelled, missed and completed
  // cases; this is the one it could not see. Every past appointment in the
  // measurement baseline is still `SCHEDULED`, because nobody goes back to
  // mark last Tuesday, so in practice this was the common case, not the
  // edge one.
  it("refuses a confirmation for an appointment that has already started", async () => {
    vi.setSystemTime(new Date("2026-09-20T11:31:00.000Z"));
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "SCHEDULED" }) as never,
    );

    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx),
    ).rejects.toMatchObject({
      messageKey: "error.notifications.appointmentPast",
    });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("refuses to log a manual send for one that has already started", async () => {
    vi.setSystemTime(new Date("2026-09-21T08:00:00.000Z"));
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "SCHEDULED" }) as never,
    );

    await expect(
      logManualMessage("a-1", "APPOINTMENT_REMINDER", ctx),
    ).rejects.toMatchObject({
      messageKey: "error.notifications.appointmentPast",
    });
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
  });

  it("tells the screen an appointment that has started is closed", async () => {
    vi.setSystemTime(new Date("2026-09-20T11:30:00.000Z"));
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "SCHEDULED" }) as never,
    );

    // The page asks the service rather than reading the status, so what is
    // offered and what is accepted cannot drift apart.
    await expect(previewAppointmentMessages("clinic-1", "a-1")).resolves.toMatchObject({
      closed: true,
    });
  });

  // The one message that ends a clinic's trust in the whole system.
  it("refuses to write to the owner of an animal that died", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ pet: { name: "Sarı", deceased: true, archivedAt: null } }) as never,
    );
    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_REMINDER", ctx),
    ).rejects.toMatchObject({ messageKey: "error.notifications.petSilenced" });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("refuses for an archived animal too", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({
        pet: { name: "Sarı", deceased: false, archivedAt: new Date("2026-09-01") },
      }) as never,
    );
    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx),
    ).rejects.toMatchObject({ messageKey: "error.notifications.petSilenced" });
  });

  // Recording a manual send on the wrong channel makes every count drawn
  // from message_logs wrong, and it was hard-coded to WhatsApp.
  it("logs a manual send on the clinic's own channel, as MANUAL", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appointment() as never);

    await logManualMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx);

    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: "SMS", status: "MANUAL" }),
    });
  });

  it("is admin/staff only", async () => {
    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("automaticSendBlocked", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  const failedAt = (hoursAgo: number) => ({
    status: "FAILED",
    createdAt: new Date(now.getTime() - hoursAgo * 3_600_000),
  });

  it("blocks resends after a successful or manual send", () => {
    expect(automaticSendBlocked([{ status: "SENT", createdAt: now }], now)).toBe(true);
    expect(automaticSendBlocked([{ status: "MANUAL", createdAt: now }], now)).toBe(true);
  });

  it("sends when nothing has been tried", () => {
    expect(automaticSendBlocked([], now)).toBe(false);
  });

  // The sweep runs hourly. Without a wait, the three attempts a candidate
  // gets would be spent within three hours of the same provider outage.
  it("waits at least six hours after a failure", () => {
    expect(automaticSendBlocked([failedAt(1)], now)).toBe(true);
    expect(automaticSendBlocked([failedAt(5.9)], now)).toBe(true);
    expect(automaticSendBlocked([failedAt(6)], now)).toBe(false);
  });

  it("measures the wait from the most recent failure", () => {
    expect(automaticSendBlocked([failedAt(20), failedAt(2)], now)).toBe(true);
    expect(automaticSendBlocked([failedAt(20), failedAt(7)], now)).toBe(false);
  });

  it("gives up after three failures however old they are", () => {
    expect(automaticSendBlocked([failedAt(40), failedAt(30), failedAt(20)], now)).toBe(
      true,
    );
  });
});

describe("notifyAppointmentBooked", () => {
  // The automatic confirmation had every gate except the one about time.
  // Writing up yesterday's walk-in is ordinary clinic work, and it sent the
  // owner "your appointment has been booked" for a time already gone. The
  // appointment page was refusing to offer that same message at that same
  // moment, so the screen and the server disagreed about what was true —
  // which is the one thing `previewAppointmentMessages` exists to prevent.
  it("says nothing about an appointment whose time has passed", async () => {
    vi.setSystemTime(new Date("2026-09-21T09:00:00.000Z"));
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ startsAt: new Date("2026-09-20T07:00:00.000Z") }) as never,
    );

    await notifyAppointmentBooked("a-1", ctx);

    expect(transport.send).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
  });

  it("says nothing about one created already cancelled", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      appointment({ status: "CANCELLED" }) as never,
    );

    await notifyAppointmentBooked("a-1", ctx);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("still confirms a booking that is ahead and open", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appointment() as never);
    transport.send.mockResolvedValue({ providerId: "job-44" });

    await notifyAppointmentBooked("a-1", ctx);

    expect(transport.send).toHaveBeenCalled();
  });
});

describe("runReminderSweep", () => {
  beforeEach(() => {
    vi.mocked(prisma.clinic.findMany).mockResolvedValue([clinicRow] as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);
  });

  // The automatic path is the one that actually reaches an owner unasked,
  // so the exclusion has to be in the query, not in a later check someone
  // can forget to call.
  it("never picks up an appointment for a dead or archived animal", async () => {
    await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));

    const where = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]
      ?.where as Record<string, unknown>;
    expect(where.pet).toEqual({ deceased: false, archivedAt: null });
  });

  it("keeps a reminder that names no animal, drops one whose animal is gone", async () => {
    await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));

    const where = vi.mocked(prisma.reminder.findMany).mock.calls[0][0]
      ?.where as Record<string, unknown>;
    expect(where.OR).toEqual([
      { petId: null },
      { pet: { deceased: false, archivedAt: null } },
    ]);
  });
});

// Consent is three-valued: null means nobody asked. Every path that can
// reach an owner has to treat that as "no", and the three of them arrive
// at it three different ways -- a thrown error, an early return, and a
// database filter. That is three places to get it right and three places
// for the next person to add a fourth without noticing.
//
// This was already true when the column became nullable; it is written
// down here so that it stays a contract rather than a coincidence. A
// migration that turns a hundred and thirty-eight `false`s into nulls
// must not make a single message go out that would not have gone out the
// day before.
describe("a client nobody has asked", () => {
  const unasked = () =>
    appointment({ client: { ...appointment().client, notificationsOptIn: null } });

  it("cannot be sent to by hand", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(unasked() as never);

    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", ctx),
    ).rejects.toMatchObject({ messageKey: "error.notifications.optedOut" });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("is not sent a confirmation when an appointment is booked", async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      ...clinicRow,
      settings: {
        notifications: {
          channel: "SMS",
          whatsapp: { enabled: true, confirmOnBooking: true },
        },
      },
    } as never);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(unasked() as never);

    await notifyAppointmentBooked("a-1", ctx);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("is excluded by the sweep's own queries, not by a later check", async () => {
    // Set here rather than inherited: the sweep's own describe sets the
    // same three, and a test that only passes because an earlier block
    // ran first passes for the wrong reason.
    vi.mocked(prisma.clinic.findMany).mockResolvedValue([clinicRow] as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);


    // In the query for the same reason the dead-animal filter is: the
    // automatic path reaches an owner with nobody watching, and a guard
    // that lives after the read is a guard somebody can forget to call.
    // `true` and not `{ not: false }`: the second would pick up exactly
    // the clients this migration created.
    await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));

    for (const mock of [prisma.appointment.findMany, prisma.reminder.findMany]) {
      const where = vi.mocked(mock).mock.calls[0][0]?.where as Record<
        string,
        Record<string, unknown>
      >;
      expect(where.client.notificationsOptIn).toBe(true);
    }
  });
});

describe("parseNotificationSettings", () => {
  it("defaults to SMS with sensible reminder timing", () => {
    const s = parseNotificationSettings(undefined);
    expect(s.channel).toBe("SMS");
    expect(s.whatsapp.reminder).toEqual({ mode: "morningOf", hoursBefore: 3, morningHour: 9 });
    expect(s.whatsapp.reminders).toEqual({ enabled: true, daysBefore: 3 });
  });
  it("keeps WHATSAPP when chosen and clamps out-of-range numbers", () => {
    const s = parseNotificationSettings({
      channel: "WHATSAPP",
      whatsapp: { reminder: { mode: "hoursBefore", hoursBefore: 999, morningHour: 30 } },
    });
    expect(s.channel).toBe("WHATSAPP");
    expect(s.whatsapp.reminder.hoursBefore).toBe(168);
    expect(s.whatsapp.reminder.morningHour).toBe(23);
  });
});
