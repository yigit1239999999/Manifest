import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    diagnostic: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDiagnostic, deleteDiagnostic } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VET_TECH",
};

const validInput = {
  petId: "pet-1",
  visitId: null,
  type: "BLOOD" as const,
  name: "CBC",
  performedAt: new Date("2026-05-22T10:00:00.000Z"),
  result: null,
  interpretation: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createDiagnostic", () => {
  it("denies RECEPTIONIST", async () => {
    await expect(
      createDiagnostic(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.diagnostic.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet isn't in the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(createDiagnostic(validInput, ctx)).rejects.toBeInstanceOf(AppError);
  });

  it("persists with clinicId and the structured fields", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.diagnostic.create).mockResolvedValue({ id: "d-1", petId: "pet-1" } as never);

    await createDiagnostic(validInput, ctx);

    expect(prisma.diagnostic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        type: "BLOOD",
        name: "CBC",
      }),
    });
  });
});

describe("deleteDiagnostic", () => {
  it("rejects rows from another clinic", async () => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue(null);
    await expect(deleteDiagnostic("d-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.diagnostic.delete).not.toHaveBeenCalled();
  });

  it("deletes and audits", async () => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue({
      id: "d-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.diagnostic.delete).mockResolvedValue({} as never);

    await deleteDiagnostic("d-1", ctx);

    expect(prisma.diagnostic.delete).toHaveBeenCalledWith({ where: { id: "d-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE", entityType: "Diagnostic" }),
    });
  });
});
