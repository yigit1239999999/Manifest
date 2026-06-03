import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    reminder: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    client: { findFirst: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createReminder, markReminderStatus } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  clientId: "client-1",
  petId: null,
  type: "VACCINATION_DUE" as const,
  title: "Annual rabies booster",
  body: null,
  dueAt: new Date("2026-06-22T10:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createReminder", () => {
  it("rejects when the client isn't in the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
    await expect(createReminder(validInput, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet doesn't belong to the client", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "client-1" } as never);
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(
      createReminder({ ...validInput, petId: "pet-x" }, ctx),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.pet.findFirst).toHaveBeenCalledWith({
      where: { id: "pet-x", clinicId: "clinic-1", ownerId: "client-1" },
      select: { id: true },
    });
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("creates the reminder scoped to the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "client-1" } as never);
    vi.mocked(prisma.reminder.create).mockResolvedValue({
      id: "rem-1",
      clientId: "client-1",
      petId: null,
    } as never);

    await createReminder(validInput, ctx);

    expect(prisma.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        clientId: "client-1",
        title: "Annual rabies booster",
      }),
    });
  });
});

describe("markReminderStatus", () => {
  it("rejects when the reminder isn't in the clinic", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
    await expect(
      markReminderStatus("rem-x", "SENT", ctx),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it("stamps sentAt only when the new status is SENT", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue({ id: "rem-1" } as never);
    vi.mocked(prisma.reminder.update).mockResolvedValue({} as never);

    await markReminderStatus("rem-1", "SENT", ctx);

    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: "rem-1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });

  it("does not stamp sentAt when transitioning to ACKNOWLEDGED", async () => {
    vi.mocked(prisma.reminder.findFirst).mockResolvedValue({ id: "rem-1" } as never);
    vi.mocked(prisma.reminder.update).mockResolvedValue({} as never);

    await markReminderStatus("rem-1", "ACKNOWLEDGED", ctx);

    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: "rem-1" },
      data: { status: "ACKNOWLEDGED", sentAt: undefined },
    });
  });
});
