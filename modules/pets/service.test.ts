import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pet: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    client: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { archivePet, createPet, updatePet } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  ownerId: "owner-1",
  name: "Biscuit",
  species: "DOG" as const,
  breed: null,
  sex: "UNKNOWN" as const,
  neutered: false,
  birthDate: null,
  color: null,
  weightKg: null,
  microchipId: null,
  insuranceProvider: null,
  insurancePolicy: null,
  alerts: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createPet", () => {
  it("rejects creation when the owner is in another clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(createPet(validInput, ctx)).rejects.toBeInstanceOf(AppError);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-1", clinicId: "clinic-1", archivedAt: null },
      select: { id: true },
    });
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  it("creates a pet scoped to the active clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet(validInput, ctx);

    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        ownerId: "owner-1",
        name: "Biscuit",
        species: "DOG",
      }),
    });
  });
});

describe("updatePet", () => {
  it("refuses to update a pet outside the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await expect(updatePet("p-x", validInput, ctx)).rejects.toBeInstanceOf(
      AppError,
    );

    expect(prisma.pet.findFirst).toHaveBeenCalledWith({
      where: { id: "p-x", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it("refuses to assign a pet to an owner outside the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "p-1" } as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(updatePet("p-1", validInput, ctx)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it("updates when both pet and owner belong to the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "p-1" } as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    await updatePet("p-1", validInput, ctx);

    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: expect.objectContaining({ name: "Biscuit" }),
    });
  });
});

describe("archivePet", () => {
  it("returns the archived pet's identifiers and writes audit", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "p-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    const result = await archivePet("p-1", ctx);

    expect(result.ownerId).toBe("owner-1");
    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ARCHIVE", entityType: "Pet" }),
    });
  });
});
