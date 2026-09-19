import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { attemptsExhausted, sendAppointmentMessage } from "./service";
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
    startsAt: new Date("2026-09-20T11:30:00.000Z"),
    durationMinutes: 30,
    type: "VACCINATION",
    pet: { name: "Sarı" },
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.clinic.findUnique).mockResolvedValue(clinicRow as never);
  vi.mocked(prisma.messageLog.create).mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "m-1", ...data }) as never,
  );
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

  it("is admin/staff only", async () => {
    await expect(
      sendAppointmentMessage("a-1", "APPOINTMENT_CONFIRMATION", { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("attemptsExhausted", () => {
  it("blocks resends after a successful or manual send", () => {
    expect(attemptsExhausted([{ status: "SENT" }])).toBe(true);
    expect(attemptsExhausted([{ status: "MANUAL" }])).toBe(true);
  });
  it("allows retries until the failure cap", () => {
    expect(attemptsExhausted([])).toBe(false);
    expect(attemptsExhausted([{ status: "FAILED" }, { status: "FAILED" }])).toBe(false);
    expect(attemptsExhausted([{ status: "FAILED" }, { status: "FAILED" }, { status: "FAILED" }])).toBe(true);
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
