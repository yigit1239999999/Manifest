import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createVisit, updateVisit } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  petId: "pet-1",
  vetId: null,
  visitedAt: new Date("2026-05-22T10:00:00.000Z"),
  type: "WELLNESS_CHECK" as const,
  chiefComplaint: null,
  subjective: null,
  objective: null,
  assessment: null,
  plan: null,
  weightKg: null,
  temperatureC: null,
  heartRateBpm: null,
  respiratoryRateBpm: null,
  followupAt: null,
  totalCents: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createVisit", () => {
  it("rejects a visit on a pet from another clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await expect(createVisit(validInput, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it("derives clientId from the pet's owner and uses the active vet", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({ id: "v-1" } as never);

    await createVisit(validInput, ctx);

    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        clientId: "owner-1",
        vetId: "user-1",
      }),
    });
  });
});

describe("updateVisit", () => {
  it("refuses to update a visit from another clinic", async () => {
    vi.mocked(prisma.visit.findFirst).mockResolvedValue(null);

    await expect(
      updateVisit("v-x", validInput, ctx),
    ).rejects.toBeInstanceOf(AppError);

    expect(prisma.visit.update).not.toHaveBeenCalled();
  });
});
