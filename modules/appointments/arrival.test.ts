import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { setArrival, undoArrival } from "./arrival";

const ctx = { clinicId: "clinic-1", userId: "u-1", userName: "T", userRole: "RECEPTIONIST" };
const now = new Date("2026-10-07T09:00:00.000Z");

function stored(over: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    status: "SCHEDULED",
    startsAt: new Date("2026-10-07T08:30:00.000Z"),
    petId: "p-1",
    clientId: "c-1",
    visit: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  vi.mocked(prisma.appointment.update).mockResolvedValue({ id: "a-1" } as never);
});

describe("setArrival", () => {
  it("marks a waiting appointment as arrived and audits the change", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(stored() as never);
    const result = await setArrival("a-1", "ARRIVED", ctx, now);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "a-1" },
      data: { status: "ARRIVED" },
    });
    expect(result.previous).toBe("SCHEDULED");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("is scoped to the clinic", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    await expect(setArrival("a-1", "ARRIVED", ctx, now)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(vi.mocked(prisma.appointment.findFirst).mock.calls[0][0]?.where).toEqual({
      id: "a-1",
      clinicId: "clinic-1",
    });
  });

  // The vet marked next week's appointment as a no-show from today's
  // screen and nothing stopped it.
  it("refuses a no-show before the appointment's time", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ startsAt: new Date("2026-10-07T10:00:00.000Z") }) as never,
    );
    await expect(setArrival("a-1", "NO_SHOW", ctx, now)).rejects.toMatchObject({
      messageKey: "error.validation.noShowBeforeStart",
    });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("allows a no-show once the hour has passed", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(stored() as never);
    await setArrival("a-1", "NO_SHOW", ctx, now);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "a-1" },
      data: { status: "NO_SHOW" },
    });
  });

  it("allows an early arrival", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ startsAt: new Date("2026-10-07T10:00:00.000Z") }) as never,
    );
    await setArrival("a-1", "ARRIVED", ctx, now);
    expect(prisma.appointment.update).toHaveBeenCalled();
  });

  it("does not touch an appointment a visit has answered", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ visit: { id: "v-1" } }) as never,
    );
    await expect(setArrival("a-1", "ARRIVED", ctx, now)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("does not overwrite an outcome somebody already recorded", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ status: "NO_SHOW" }) as never,
    );
    await expect(setArrival("a-1", "ARRIVED", ctx, now)).rejects.toMatchObject({
      messageKey: "error.validation.appointmentNotWaiting",
    });
  });

  it("is refused to a role without appointment rights", async () => {
    await expect(
      setArrival("a-1", "ARRIVED", { ...ctx, userRole: "NOPE" }, now),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("undoArrival", () => {
  it("puts the waiting status back", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ status: "ARRIVED" }) as never,
    );
    await undoArrival("a-1", "CONFIRMED", ctx);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "a-1" },
      data: { status: "CONFIRMED" },
    });
  });

  it("cannot be used to reopen a finished appointment", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      stored({ status: "COMPLETED" }) as never,
    );
    await expect(undoArrival("a-1", "SCHEDULED", ctx)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("only goes back to a waiting status", async () => {
    await expect(undoArrival("a-1", "COMPLETED", ctx)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });
});
