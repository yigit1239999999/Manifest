import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    vaccination: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createVaccination, deleteVaccination } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VET_TECH",
};

const validInput = {
  petId: "pet-1",
  visitId: null,
  administeredById: null,
  name: "Rabies",
  manufacturer: null,
  lotNumber: null,
  site: null,
  administeredAt: new Date("2026-05-22T10:00:00.000Z"),
  nextDueAt: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createVaccination", () => {
  it("allows VET_TECH to administer", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.vaccination.create).mockResolvedValue({ id: "v-1", petId: "pet-1" } as never);

    await createVaccination(validInput, ctx);

    expect(prisma.vaccination.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        name: "Rabies",
        administeredById: "user-1",
      }),
    });
  });

  it("denies RECEPTIONIST", async () => {
    await expect(
      createVaccination(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.vaccination.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet isn't in the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(createVaccination(validInput, ctx)).rejects.toBeInstanceOf(AppError);
  });
});

describe("deleteVaccination", () => {
  it("rejects rows from another clinic", async () => {
    vi.mocked(prisma.vaccination.findFirst).mockResolvedValue(null);
    await expect(deleteVaccination("v-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.vaccination.delete).not.toHaveBeenCalled();
  });

  it("deletes and audits", async () => {
    vi.mocked(prisma.vaccination.findFirst).mockResolvedValue({
      id: "v-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.vaccination.delete).mockResolvedValue({} as never);

    const out = await deleteVaccination("v-1", ctx);

    expect(out.petId).toBe("pet-1");
    expect(prisma.vaccination.delete).toHaveBeenCalledWith({ where: { id: "v-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE", entityType: "Vaccination" }),
    });
  });
});
