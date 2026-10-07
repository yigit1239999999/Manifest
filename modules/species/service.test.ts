import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn(), update: vi.fn() },
    customSpecies: { findFirst: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { deleteCustomSpecies, setEnabledSpecies } from "./service";

const admin = { clinicId: "clinic-1", userId: "u-1", userName: "A", userRole: "ADMIN" };
const vet = { ...admin, userRole: "VETERINARIAN" };

beforeEach(() => vi.resetAllMocks());

describe("setEnabledSpecies", () => {
  it("is admin-only", async () => {
    await expect(setEnabledSpecies(["DOG"], vet)).rejects.toBeInstanceOf(AppError);
    expect(prisma.clinic.update).not.toHaveBeenCalled();
  });

  it("rejects an empty selection", async () => {
    await expect(setEnabledSpecies([], admin)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects unknown species keys", async () => {
    await expect(setEnabledSpecies(["DOG", "DRAGON"], admin)).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("merges into existing clinic settings in canonical order", async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      settings: { theme: "x" },
    } as never);
    vi.mocked(prisma.clinic.update).mockResolvedValue({} as never);

    const result = await setEnabledSpecies(["CAT", "DOG", "HORSE"], admin);

    expect(result).toEqual(["DOG", "CAT", "HORSE"]);
    expect(prisma.clinic.update).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: { settings: { theme: "x", enabledSpecies: ["DOG", "CAT", "HORSE"] } },
    });
  });
});

describe("deleteCustomSpecies", () => {
  it("refuses to delete a species that pets still use", async () => {
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue({
      id: "cs-1",
      name: "Kirpi",
      _count: { pets: 2 },
    } as never);

    await expect(deleteCustomSpecies("cs-1", admin)).rejects.toBeInstanceOf(AppError);
    expect(prisma.customSpecies.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused species scoped to the clinic", async () => {
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue({
      id: "cs-1",
      name: "Kirpi",
      _count: { pets: 0 },
    } as never);
    vi.mocked(prisma.customSpecies.delete).mockResolvedValue({} as never);

    await deleteCustomSpecies("cs-1", admin);

    expect(prisma.customSpecies.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cs-1", clinicId: "clinic-1" } }),
    );
    expect(prisma.customSpecies.delete).toHaveBeenCalledWith({ where: { id: "cs-1" } });
  });
});
