import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    appointment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

const notifyAppointmentBooked = vi.fn();
vi.mock("@/modules/notifications/service", () => ({
  notifyAppointmentBooked: (...args: unknown[]) =>
    notifyAppointmentBooked(...args),
}));

import { prisma } from "@/lib/prisma";
import { createAppointment } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const startsAt = new Date("2026-09-25T07:30:00.000Z");

const validInput = {
  petId: "pet-1",
  vetId: null,
  startsAt,
  durationMinutes: 30,
  type: "WELLNESS_CHECK" as const,
  status: "SCHEDULED" as const,
  reason: null,
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  vi.mocked(prisma.pet.findFirst).mockResolvedValue({
    id: "pet-1",
    ownerId: "owner-1",
  } as never);
});

// Reproduced three times out of three against a slow route: the staff member
// submits again and the clinic has two identical appointments. What made it
// worth a rule rather than a fix for that one cause is that the causes cannot
// be listed — a double click, a refreshed tab, a dropped connection and a
// restarted server all arrive the same way.
describe("createAppointment, asked twice for the same slot", () => {
  it("returns the appointment that already exists", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
      petId: "pet-1",
    } as never);

    const result = await createAppointment(validInput, ctx);

    expect(result).toMatchObject({ id: "a-1" });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("does not send the owner a second confirmation", async () => {
    // The row is the smaller half of the harm. The owner getting the same
    // "your appointment is booked" twice is the release's whole promise,
    // broken by the app itself.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
    } as never);

    await createAppointment(validInput, ctx);

    expect(notifyAppointmentBooked).not.toHaveBeenCalled();
  });

  it("writes no second audit entry either", async () => {
    // A CREATE in the trail that created nothing would make the history
    // disagree with the records it is a history of.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("looks for the clash on clinic, animal and instant, ignoring cancelled", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: {
        clinicId: "clinic-1",
        petId: "pet-1",
        startsAt,
        status: { not: "CANCELLED" },
      },
    });
  });

  it("still books when the only appointment at that instant was cancelled", async () => {
    // The one case where a second booking is real: the owner cancelled and
    // rang back. `findFirst` excludes cancelled rows, so it finds nothing
    // and the booking goes through — refusing it would be the app inventing
    // a rule the clinic does not have.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    const result = await createAppointment(validInput, ctx);

    expect(result).toMatchObject({ id: "a-2" });
    expect(notifyAppointmentBooked).toHaveBeenCalledWith("a-2", ctx);
  });

  it("reads and writes in one serializable transaction", async () => {
    // Read-then-write is the exact shape two overlapping submits defeat:
    // without this both read "none" and both insert.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
});
