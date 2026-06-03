import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    treatment: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createTreatment, deleteTreatment } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VETERINARIAN",
};

const validInput = {
  petId: "pet-1",
  visitId: null,
  performedById: null,
  name: "Dental cleaning",
  code: null,
  performedAt: new Date("2026-05-22T10:00:00.000Z"),
  durationMinutes: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createTreatment", () => {
  it("denies RECEPTIONIST", async () => {
    await expect(
      createTreatment(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.treatment.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet isn't in the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(createTreatment(validInput, ctx)).rejects.toBeInstanceOf(AppError);
  });

  it("persists with clinicId and defaults performedById to the actor", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.treatment.create).mockResolvedValue({ id: "t-1", petId: "pet-1" } as never);

    await createTreatment(validInput, ctx);

    expect(prisma.treatment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        name: "Dental cleaning",
        performedById: "user-1",
      }),
    });
  });
});

describe("deleteTreatment", () => {
  it("rejects rows from another clinic", async () => {
    vi.mocked(prisma.treatment.findFirst).mockResolvedValue(null);
    await expect(deleteTreatment("t-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.treatment.delete).not.toHaveBeenCalled();
  });

  it("deletes and audits", async () => {
    vi.mocked(prisma.treatment.findFirst).mockResolvedValue({
      id: "t-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.treatment.delete).mockResolvedValue({} as never);

    await deleteTreatment("t-1", ctx);

    expect(prisma.treatment.delete).toHaveBeenCalledWith({ where: { id: "t-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE", entityType: "Treatment" }),
    });
  });
});
