import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    appointment: { findFirst: vi.fn(), findMany: vi.fn() },
    reminder: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    messageLog: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const transport = {
  channel: "SMS" as const,
  name: "netgsm",
  isConfigured: vi.fn(() => true),
  send: vi.fn(),
  // Optional on the interface, because a channel that cannot answer
  // about delivery has to say so by absence. Declared here so a test
  // can hand it one.
  reports: undefined as
    | ((ids: string[]) => Promise<Record<string, { state: string; code: string | null; at: Date | null }>>)
    | undefined,
};
vi.mock("@/lib/messaging/transports", () => ({
  getTransport: vi.fn(() => transport),
  isChannelConfigured: vi.fn(() => true),
  transportName: vi.fn(() => "netgsm"),
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { TransportError } from "@/lib/messaging/types";
import {
  automaticSendBlock,
  automaticSendBlocked,
  notifyAppointmentBooked,
  runDeliveryReportSweep,
  runReminderSweep,
  logManualMessage,
  previewAppointmentMessages,
  reminderDeliveryState,
  sendAppointmentMessage,
  sendReminderNow,
} from "./service";
import { parseNotificationSettings, toMessagingProfile } from "./settings";

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

  // What is stored has to be classifiable, because a screen decides
  // from it whether to send a vet to the settings page or to a phone.
  it("stores the transport's code, not the provider's sentence", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appointment() as never);
    transport.send.mockRejectedValue(
      new TransportError("sender_title_not_registered", "Gonderici adi onayli degil"),
    );

    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_REMINDER", ctx),
    ).rejects.toBeInstanceOf(AppError);

    const logged = vi.mocked(prisma.messageLog.create).mock.calls[0][0] as {
      data: { status: string; error: string };
    };
    expect(logged.data).toMatchObject({
      status: "FAILED",
      error: "sender_title_not_registered",
    });
    // The provider's wording is free text it may change at any time; it
    // belongs in the log line a person reads, not in a column code
    // depends on.
    expect(logged.data.error).not.toContain("Gonderici");
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

  // Three different situations, and the sweep summary has to tell them
  // apart: one is finished, one is waiting, and one wants a person.
  it("names which of the three rules held the candidate back", () => {
    expect(automaticSendBlock([{ status: "SENT", createdAt: now }], now)).toBe("alreadySent");
    expect(automaticSendBlock([failedAt(1)], now)).toBe("coolingOff");
    expect(automaticSendBlock([failedAt(40), failedAt(30), failedAt(20)], now)).toBe(
      "attemptsExhausted",
    );
    expect(automaticSendBlock([], now)).toBeNull();
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
    vi.mocked(prisma.clinic.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
  });

  // Ninety-six sweeps a day once the scheduler is on, and the subject of
  // each is the handful of clinics with messaging on -- not the table.
  it("asks the database for the clinics that could send, not for all of them", async () => {
    await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));

    const where = vi.mocked(prisma.clinic.findMany).mock.calls[0][0]
      ?.where as Record<string, unknown>;
    expect(where.settings).toEqual({
      path: ["notifications", "whatsapp", "enabled"],
      equals: true,
    });
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

  // The whole reason the census exists. Before it, both of these sweeps
  // returned the same summary -- zeros -- and the two situations need
  // opposite things done about them: one is a clinic with nobody to
  // write to, the other is a clinic whose owners were never asked for
  // consent. Reading the second as the first is how "reminders do not
  // work" gets answered with "there was nothing to send".
  it("tells an empty window apart from one every rule emptied", async () => {
    const empty = await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));
    expect(empty.appointments.pool).toBe(0);
    expect(empty.appointments.skipped.optedOut).toBe(0);

    vi.mocked(prisma.$queryRaw).mockImplementation((async () => [
      { reason: "optedOut", n: 4 },
      { reason: "petSilenced", n: 1 },
      { reason: "eligible", n: 0 },
    ]) as never);

    const filtered = await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));
    expect(filtered.appointments.pool).toBe(5);
    expect(filtered.appointments.sent).toBe(0);
    expect(filtered.appointments.skipped.optedOut).toBe(4);
    expect(filtered.appointments.skipped.petSilenced).toBe(1);
  });

  // `notDue` is the healthy zero: the candidate is fine, its hour has
  // not come. It has to be countable apart from every unhealthy one.
  it("counts a candidate whose hour has not come, and the one whose has", async () => {
    vi.mocked(prisma.$queryRaw).mockImplementation((async () => [
      { reason: "eligible", n: 2 },
    ]) as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      // morningOf at 09:00 Istanbul: due for today's appointment, not for
      // the one three days out.
      appointment({ id: "a-soon", messages: [] }),
      appointment({
        id: "a-later",
        startsAt: new Date("2026-09-23T11:30:00.000Z"),
        messages: [],
      }),
    ] as never);
    transport.send.mockResolvedValue({ providerId: "job-90" });

    const summary = await runReminderSweep(new Date("2026-09-20T06:30:00.000Z"));

    expect(summary.appointments.candidates).toBe(2);
    expect(summary.appointments.sent).toBe(1);
    expect(summary.appointments.skipped.notDue).toBe(1);
    // Nothing else may absorb a row: the pool is the sum of its parts,
    // which is what makes the summary readable at all.
    const skipped = Object.values(summary.appointments.skipped).reduce((a, b) => a + b, 0);
    expect(summary.appointments.pool).toBe(
      summary.appointments.sent + summary.appointments.failed + skipped,
    );
  });

  // A clinic that swept nothing because it is switched off is not a
  // clinic with nothing to send, and the count of clinics said neither.
  it("says how many clinics it actually swept and why it skipped the rest", async () => {
    // Two clinics exist; only one comes back from the filtered read, and
    // the difference is what "messaging is off" has to be counted from.
    vi.mocked(prisma.clinic.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.clinic.findMany).mockResolvedValue([clinicRow] as never);

    const summary = await runReminderSweep(new Date("2026-09-20T06:00:00.000Z"));

    expect(summary.clinics).toEqual({
      total: 2,
      swept: 1,
      messagingOff: 1,
      channelNotConfigured: 0,
    });
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

// The list row reads from `MessageLog`, never from `Reminder.status`,
// and these are the cases where the two disagree.
describe("reminderDeliveryState", () => {
  const clinic = toMessagingProfile(clinicRow as never);
  const row = (overrides: Record<string, unknown> = {}) => ({
    status: "PENDING",
    dueAt: new Date("2026-09-25T09:00:00.000Z"),
    client: { phone: "0532 123 45 67", notificationsOptIn: true },
    pet: { deceased: false, archivedAt: null },
    messages: [] as { status: string; createdAt: Date; error: string | null; channel: "SMS" }[],
    ...overrides,
  });

  it("promises a send date when everything is in place", () => {
    const state = reminderDeliveryState(row(), clinic);
    // daysBefore 3, morningHour 9, Europe/Istanbul: 22 September 09:00
    // local, which is 06:00 UTC.
    expect(state).toEqual({
      state: "scheduled",
      sendAt: new Date("2026-09-22T06:00:00.000Z"),
      channel: "SMS",
    });
  });

  it("reports the failure with its reason and how many attempts it took", () => {
    const state = reminderDeliveryState(
      row({
        messages: [
          { status: "FAILED", createdAt: new Date("2026-09-20T08:00:00.000Z"), error: "sender_title_not_registered", channel: "SMS" },
          { status: "FAILED", createdAt: new Date("2026-09-19T08:00:00.000Z"), error: "sender_title_not_registered", channel: "SMS" },
        ],
      }),
      clinic,
    );
    expect(state).toEqual({
      state: "failed",
      at: new Date("2026-09-20T08:00:00.000Z"),
      error: "sender_title_not_registered",
      attempts: 2,
      // Two of three: the sweep will try again, which is a different
      // sentence from "it has stopped trying".
      exhausted: false,
      // An unapproved sender title fails every message the clinic sends,
      // so it is one fact about the clinic rather than one about this
      // owner -- the difference between changing a setting and phoning
      // forty people.
      scope: "CLINIC",
      channel: "SMS",
    });
  });

  it("marks the attempts spent, and says nothing it cannot know", () => {
    const failedAt = (day: number, error: string | null) => ({
      status: "FAILED",
      createdAt: new Date(`2026-09-${day}T08:00:00.000Z`),
      error,
      channel: "SMS" as const,
    });

    const spent = reminderDeliveryState(
      row({ messages: [failedAt(18, "message_too_long_or_invalid"), failedAt(17, "message_too_long_or_invalid"), failedAt(16, "message_too_long_or_invalid")] }),
      clinic,
    );
    expect(spent).toMatchObject({ attempts: 3, exhausted: true, scope: "MESSAGE" });

    // A row written before the code was stored holds a provider
    // sentence, and nothing can classify that. `null` has to stay
    // tellable from both answers rather than defaulting to one.
    const older = reminderDeliveryState(
      row({ messages: [failedAt(18, "Gonderici adi onayli degil")] }),
      clinic,
    );
    expect(older).toMatchObject({ scope: null, exhausted: false });
  });

  // A fact does not change when a setting does. Switching messaging off
  // today must not rewrite what happened last week -- the row would
  // then read "notifications are off" about a message the owner has in
  // their hand.
  it("keeps a send true after the clinic switches messaging off", () => {
    const off = toMessagingProfile({
      ...clinicRow,
      settings: { notifications: { channel: "SMS", whatsapp: { enabled: false } } },
    } as never);
    const state = reminderDeliveryState(
      row({
        messages: [
          { status: "SENT", createdAt: new Date("2026-09-18T06:00:00.000Z"), error: null, channel: "SMS" },
        ],
      }),
      off,
    );
    expect(state).toEqual({
      state: "sent",
      at: new Date("2026-09-18T06:00:00.000Z"),
      channel: "SMS",
    });
  });

  it("names the reason nothing will go, clinic-wide reasons first", () => {
    const off = toMessagingProfile({
      ...clinicRow,
      settings: { notifications: { channel: "SMS", whatsapp: { enabled: false } } },
    } as never);
    // Both switched off and not consented: the vet is sent to the
    // setting, which is the one they can act on.
    expect(
      reminderDeliveryState(row({ client: { phone: null, notificationsOptIn: false } }), off),
    ).toEqual({ state: "disabled" });

    // Refused and never asked are one falsy value in code and two
    // different mornings for a vet: nothing to do about the first, a
    // phone call about the second.
    expect(
      reminderDeliveryState(row({ client: { phone: "0532 123 45 67", notificationsOptIn: false } }), clinic),
    ).toEqual({ state: "optedOut" });

    expect(
      reminderDeliveryState(row({ client: { phone: "0532 123 45 67", notificationsOptIn: null } }), clinic),
    ).toEqual({ state: "neverAsked" });

    expect(
      reminderDeliveryState(row({ client: { phone: null, notificationsOptIn: true } }), clinic),
    ).toEqual({ state: "noPhone" });
  });

  // Silence is the defect this sentence exists to remove: a row saying
  // nothing reads exactly like a row waiting its turn.
  it("says why a dead animal's reminder will not go, rather than nothing", () => {
    expect(
      reminderDeliveryState(row({ pet: { deceased: true, archivedAt: null } }), clinic),
    ).toEqual({ state: "petSilenced" });
    expect(
      reminderDeliveryState(row({ pet: { deceased: false, archivedAt: new Date() } }), clinic),
    ).toEqual({ state: "petSilenced" });
  });

  // The one case with genuinely nothing to report: nobody is waiting.
  it("says nothing about a closed reminder that never had a message", () => {
    expect(reminderDeliveryState(row({ status: "DISMISSED" }), clinic)).toBeNull();
  });
});

describe("sendReminderNow", () => {
  const reminderRow = (overrides: Record<string, unknown> = {}) => ({
    id: "r-1",
    type: "VACCINATION_DUE",
    title: "Karma aşı zamanı",
    body: null,
    dueAt: new Date("2026-09-25T09:00:00.000Z"),
    pet: { name: "Sarı", deceased: false, archivedAt: null },
    client: {
      id: "c-1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      phone: "0532 123 45 67",
      preferredLanguage: "tr",
      notificationsOptIn: true,
    },
    messages: [],
    ...overrides,
  });

  it("sends, records who pressed it, and closes the reminder", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(reminderRow() as never);
    transport.send.mockResolvedValue({ providerId: "job-77" });

    await sendReminderNow("r-1", ctx);

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "905321234567", language: "tr" }),
    );
    expect(vi.mocked(prisma.reminder.update).mock.calls[0][0]).toMatchObject({
      where: { id: "r-1" },
      data: { status: "SENT" },
    });
    // The sweep passes null here. A person pressing the button has to be
    // answerable for the message, so the audit row names them.
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0]).toMatchObject({
      data: { actorId: "u-1", entityType: "MessageLog" },
    });
  });

  it("refuses a second send of a message that already went out", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(
      reminderRow({
        messages: [{ status: "SENT", createdAt: new Date("2026-09-19T06:00:00.000Z") }],
      }) as never,
    );
    await expect(sendReminderNow("r-1", ctx)).rejects.toMatchObject({
      messageKey: "error.notifications.alreadySent",
    });
    expect(transport.send).not.toHaveBeenCalled();
  });

  // The sweep's waiting rules exist to stop an unattended retry loop
  // spending its three attempts on one outage. A person who has just
  // fixed the provider is exactly the escape hatch they assume.
  it("lets a person retry inside the sweep's cooling-off window", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(
      reminderRow({
        messages: [{ status: "FAILED", createdAt: new Date("2026-09-20T09:00:00.000Z") }],
      }) as never,
    );
    transport.send.mockResolvedValue({ providerId: "job-78" });

    await sendReminderNow("r-1", ctx);

    expect(transport.send).toHaveBeenCalled();
  });

  it("refuses when the owner never consented, whatever the screen offered", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(
      reminderRow({
        client: { ...reminderRow().client, notificationsOptIn: null },
      }) as never,
    );
    await expect(sendReminderNow("r-1", ctx)).rejects.toMatchObject({
      messageKey: "error.notifications.optedOut",
    });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("refuses a reminder that names a dead animal", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(
      reminderRow({ pet: { name: "Sarı", deceased: true, archivedAt: null } }) as never,
    );
    await expect(sendReminderNow("r-1", ctx)).rejects.toMatchObject({
      messageKey: "error.notifications.petSilenced",
    });
    expect(transport.send).not.toHaveBeenCalled();
  });
});


// "Sent" has only ever meant the operator took it. Until this ran,
// that was the last thing the app ever learned: a message accepted and
// then never delivered looked exactly like one in somebody's hand.
describe("runDeliveryReportSweep", () => {
  const accepted = (id: string, providerId: string) => ({
    id,
    channel: "SMS" as const,
    providerId,
  });

  beforeEach(() => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(3 as never);
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([
      accepted("m-1", "job-1"),
      accepted("m-2", "job-2"),
      accepted("m-3", "job-3"),
    ] as never);
    vi.mocked(prisma.messageLog.update).mockResolvedValue({} as never);
  });

  it("asks only about messages the provider accepted and has not answered", async () => {
    transport.reports = vi.fn(async () => ({}));

    await runDeliveryReportSweep(new Date("2026-09-20T12:00:00.000Z"));

    const where = vi.mocked(prisma.messageLog.findMany).mock.calls[0][0]
      ?.where as Record<string, unknown>;
    // A FAILED row never reached the provider and a MANUAL one never
    // went through it, so neither has a delivery to ask about.
    expect(where.status).toBe("SENT");
    expect(where.providerId).toEqual({ not: null });
    expect(where.deliveryStatus).toEqual({ in: ["UNKNOWN", "PENDING"] });
  });

  it("writes a delivery time only for the delivered one", async () => {
    transport.reports = vi.fn(async () => ({
      "job-1": { state: "delivered" as const, code: "0", at: new Date("2026-09-20T11:00:00.000Z") },
      "job-2": { state: "undelivered" as const, code: "12", at: null },
      "job-3": { state: "pending" as const, code: "1", at: null },
    }));

    const summary = await runDeliveryReportSweep(new Date("2026-09-20T12:00:00.000Z"));

    expect(summary).toMatchObject({ asked: 3, answered: 3, delivered: 1, undelivered: 1, pending: 1 });
    const writes = vi.mocked(prisma.messageLog.update).mock.calls.map((c) => c[0]);
    expect(writes[0]).toMatchObject({
      where: { id: "m-1" },
      data: { deliveryStatus: "DELIVERED", deliveredAt: new Date("2026-09-20T11:00:00.000Z") },
    });
    // Writing "now" here would turn `deliveredAt` into "when we last
    // heard", and every count drawn from it would be wrong.
    expect(writes[1]).toMatchObject({
      where: { id: "m-2" },
      data: { deliveryStatus: "UNDELIVERED", deliveredAt: null },
    });
  });

  // Silence is not a failure, and it is also not nothing: the message
  // is stamped as asked so the next run moves on to the ones nobody has
  // asked about rather than circling the same silent ids.
  it("counts a message the provider said nothing about, and stamps it", async () => {
    transport.reports = vi.fn(async () => ({}));

    const summary = await runDeliveryReportSweep(new Date("2026-09-20T12:00:00.000Z"));

    expect(summary).toMatchObject({ asked: 3, answered: 0, silent: 3 });
    for (const call of vi.mocked(prisma.messageLog.update).mock.calls) {
      expect(call[0].data).toEqual({ deliveryCheckedAt: new Date("2026-09-20T12:00:00.000Z") });
    }
  });

  // A provider outage must not be recorded as an answer about anyone.
  it("writes nothing at all when the provider call throws", async () => {
    transport.reports = vi.fn(async () => {
      throw new Error("gateway_timeout");
    });

    const summary = await runDeliveryReportSweep(new Date("2026-09-20T12:00:00.000Z"));

    expect(summary).toMatchObject({ asked: 3, answered: 0, silent: 0 });
    expect(prisma.messageLog.update).not.toHaveBeenCalled();
  });

  // `open` is what makes a small `asked` readable: fifty of fifty is a
  // finished run, fifty of nine hundred is a schedule falling behind.
  it("reports how many were open, not just how many it asked about", async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(900 as never);
    transport.reports = vi.fn(async () => ({}));

    expect((await runDeliveryReportSweep()).open).toBe(900);
  });

  it("asks nobody when nothing is open", async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(0 as never);
    transport.reports = vi.fn(async () => ({}));

    const summary = await runDeliveryReportSweep();

    expect(summary.asked).toBe(0);
    expect(prisma.messageLog.findMany).not.toHaveBeenCalled();
    expect(transport.reports).not.toHaveBeenCalled();
  });
});
