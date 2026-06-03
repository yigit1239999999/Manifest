import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    prescription: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createPrescription, updatePrescriptionStatus } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VETERINARIAN",
};

const validInput = {
  petId: "pet-1",
  visitId: null,
  prescribedById: null,
  medicationName: "Amoxicillin",
  dosage: "5mg",
  frequency: "twice daily",
  route: null,
  durationDays: null,
  refills: null,
  startedAt: new Date("2026-05-22T10:00:00.000Z"),
  endedAt: null,
  status: "ACTIVE" as const,
  instructions: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createPrescription", () => {
  it("requires prescriptions.write — denies RECEPTIONIST", async () => {
    await expect(
      createPrescription(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet isn't in the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(createPrescription(validInput, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it("writes with clinicId and defaults refills to 0", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.prescription.create).mockResolvedValue({ id: "rx-1", petId: "pet-1" } as never);

    await createPrescription(validInput, ctx);

    expect(prisma.prescription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        medicationName: "Amoxicillin",
        refills: 0,
        prescribedById: "user-1",
      }),
    });
  });
});

describe("updatePrescriptionStatus", () => {
  it("rejects when the prescription isn't in the clinic", async () => {
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null);
    await expect(
      updatePrescriptionStatus("rx-x", "COMPLETED", ctx),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.prescription.update).not.toHaveBeenCalled();
  });

  it("sets endedAt when status becomes COMPLETED", async () => {
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({
      id: "rx-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.prescription.update).mockResolvedValue({} as never);

    await updatePrescriptionStatus("rx-1", "COMPLETED", ctx);

    expect(prisma.prescription.update).toHaveBeenCalledWith({
      where: { id: "rx-1" },
      data: { status: "COMPLETED", endedAt: expect.any(Date) },
    });
  });

  it("sets endedAt when status becomes CANCELLED", async () => {
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({
      id: "rx-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.prescription.update).mockResolvedValue({} as never);

    await updatePrescriptionStatus("rx-1", "CANCELLED", ctx);

    expect(prisma.prescription.update).toHaveBeenCalledWith({
      where: { id: "rx-1" },
      data: { status: "CANCELLED", endedAt: expect.any(Date) },
    });
  });

  it("clears endedAt when reactivating to ACTIVE", async () => {
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({
      id: "rx-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.prescription.update).mockResolvedValue({} as never);

    await updatePrescriptionStatus("rx-1", "ACTIVE", ctx);

    expect(prisma.prescription.update).toHaveBeenCalledWith({
      where: { id: "rx-1" },
      data: { status: "ACTIVE", endedAt: null },
    });
  });
});
