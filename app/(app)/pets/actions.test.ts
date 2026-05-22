import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pet: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    owner: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createPet, deletePet, updatePet } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validPet = {
  name: "Biscuit",
  species: "DOG",
  ownerId: "owner-1",
  breed: "",
  sex: "UNKNOWN",
  birthDate: "",
  color: "",
  weightKg: "",
  microchipId: "",
  notes: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireSession).mockResolvedValue({
    user: {
      id: "user-1",
      clinicId: "clinic-1",
      role: "ADMIN",
      name: "Dr Test",
      email: "dr@test.com",
    },
    expires: "2999-01-01",
  } as never);
});

describe("createPet", () => {
  it("creates a pet scoped to the clinic when the owner belongs to it", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "pet-1" } as never);

    await createPet({}, formData(validPet));

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-1", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        ownerId: "owner-1",
        name: "Biscuit",
        species: "DOG",
      }),
    });
    expect(redirect).toHaveBeenCalledWith("/pets/pet-1");
  });

  it("refuses to attach a pet to an owner from another clinic", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue(null);

    const result = await createPet({}, formData(validPet));

    expect(result.fieldErrors?.ownerId?.length).toBeGreaterThan(0);
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const result = await createPet({}, formData({ ...validPet, name: "" }));

    expect(result.fieldErrors?.name?.length).toBeGreaterThan(0);
    expect(prisma.owner.findFirst).not.toHaveBeenCalled();
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  it("parses weight and birth date into typed values", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "pet-2" } as never);

    await createPet(
      {},
      formData({ ...validPet, weightKg: "12.5", birthDate: "2024-01-15" }),
    );

    const arg = vi.mocked(prisma.pet.create).mock.calls[0][0] as {
      data: { weightKg: unknown; birthDate: unknown };
    };
    expect(arg.data.weightKg).toBe(12.5);
    expect(arg.data.birthDate).toBeInstanceOf(Date);
  });
});

describe("updatePet", () => {
  it("refuses to update a pet from another clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    const result = await updatePet("pet-x", {}, formData(validPet));

    expect(prisma.pet.findFirst).toHaveBeenCalledWith({
      where: { id: "pet-x", clinicId: "clinic-1" },
      select: { id: true, ownerId: true },
    });
    expect(result.error).toBeDefined();
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it("updates a pet that belongs to the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "pet-1" } as never);

    await updatePet("pet-1", {}, formData(validPet));

    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "pet-1" },
      data: expect.objectContaining({ name: "Biscuit", ownerId: "owner-1" }),
    });
    expect(redirect).toHaveBeenCalledWith("/pets/pet-1");
  });
});

describe("deletePet", () => {
  it("does not delete a pet from another clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await deletePet("pet-x");

    expect(prisma.pet.delete).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/pets");
  });

  it("deletes a pet that belongs to the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.pet.delete).mockResolvedValue({ id: "pet-1" } as never);

    await deletePet("pet-1");

    expect(prisma.pet.delete).toHaveBeenCalledWith({ where: { id: "pet-1" } });
  });
});
