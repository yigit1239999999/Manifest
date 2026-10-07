import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    pet: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    client: { findFirst: vi.fn() },
    note: { createMany: vi.fn() },
    reminder: { updateMany: vi.fn() },
    appointment: { updateMany: vi.fn() },
    customSpecies: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) =>
    cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  archivePet,
  createPet,
  markPetDeceased,
  restorePet,
  unmarkPetDeceased,
  updatePet,
} from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  ownerId: "owner-1",
  name: "Biscuit",
  species: "DOG",
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
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
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
        customSpeciesId: null,
      }),
    });
  });

  it("creates a clinic-scoped custom species from free text", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customSpecies.create).mockResolvedValue({ id: "cs-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: "Kirpi" }, ctx);

    expect(prisma.customSpecies.create).toHaveBeenCalledWith({
      data: { clinicId: "clinic-1", name: "Kirpi" },
      select: { id: true },
    });
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ species: "OTHER", customSpeciesId: "cs-1" }),
    });
  });

  it("reuses an existing custom species (case-insensitive) instead of duplicating", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue({ id: "cs-9" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: "kirpi" }, ctx);

    expect(prisma.customSpecies.create).not.toHaveBeenCalled();
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ species: "OTHER", customSpeciesId: "cs-9" }),
    });
  });

  it.each([
    ["Kedi", "CAT"],
    ["kedi", "CAT"],
    ["KEDİ", "CAT"],
    ["Kopek", "DOG"],
    ["Cat", "CAT"],
    ["Tavsan", "RABBIT"],
    ["Sığır", "CATTLE"],
  ])("records %s as the built-in %s, with no custom species", async (typed, expected) => {
    // The defect ux-3 reported, and the half the unique index does not
    // reach: the server compared what was typed against the enum keys,
    // so "Kedi" found nothing and became a clinic-defined species. The
    // animal was then stored as OTHER, and fell out of every list that
    // groups by CAT -- present in the clinic, absent from the report.
    //
    // Both languages and either spelling, because the folding is the
    // same one the search uses and "the same name" has to mean one
    // thing everywhere.
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: typed }, ctx);

    expect(prisma.customSpecies.create).not.toHaveBeenCalled();
    expect(prisma.customSpecies.findFirst).not.toHaveBeenCalled();
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ species: expected, customSpeciesId: null }),
    });
  });

  it("still lets a clinic name something the list does not have", async () => {
    // The other side, and the reason this is a lookup rather than a
    // ban: "Kirpi" is a real thing a clinic sees and is not a built-in.
    // A check that swallowed it would close the custom species feature
    // while looking like a bug fix.
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customSpecies.create).mockResolvedValue({ id: "cs-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: "Kirpi" }, ctx);

    expect(prisma.customSpecies.create).toHaveBeenCalled();
  });

  it("looks for a species the way the clinic would recognise it", async () => {
    // "Kırpı" and "Kirpi" are one species to a vet and were two rows to
    // the product: the dedupe read used `mode: "insensitive"`, which is
    // ILIKE, which folds case and nothing else. Unlike a search that
    // misses, this one writes -- the second row is permanent, the
    // picker offers both forever, and animals get filed under either.
    //
    // A clinic-defined name on both sides here. "Köpek" would no longer
    // reach this code at all: it is a built-in under its Turkish name
    // and is resolved before the custom path.
    //
    // Asserted on the query rather than the outcome, because the
    // outcome here is a row that does not get created and every wrong
    // version of this code also does not create it, for the wrong
    // reason.
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue({ id: "cs-9" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: "Kırpı" }, ctx);

    expect(prisma.customSpecies.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinicId: ctx.clinicId, nameKey: "kirpi" },
      }),
    );
  });

  it("takes the other request's species when two vets add it at once", async () => {
    // The read above cannot close the window: both requests find
    // nothing and both insert. The unique index decides, and the loser
    // has to end up with the winner's row rather than an error shown to
    // a vet who did nothing wrong.
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "cs-winner" } as never);
    vi.mocked(prisma.customSpecies.create).mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "P2002" }),
    );
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);

    await createPet({ ...validInput, species: "Papağan" }, ctx);

    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        species: "OTHER",
        customSpeciesId: "cs-winner",
      }),
    });
  });

  it("does not swallow a failure that is not a lost race", async () => {
    // The catch is narrow on purpose. Widening it would turn a real
    // database failure into "species not found", which is a lie the
    // next person would debug from the wrong end.
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customSpecies.create).mockRejectedValue(
      Object.assign(new Error("connection reset"), { code: "P1001" }),
    );

    await expect(
      createPet({ ...validInput, species: "Papağan" }, ctx),
    ).rejects.toThrow("connection reset");
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  it("rejects a custom:<id> reference from another clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue(null);

    await expect(
      createPet({ ...validInput, species: "custom:cs-foreign" }, ctx),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });
});

const storedPet = {
  id: "p-1",
  name: "Fındık",
  ownerId: "owner-1",
  owner: { id: "owner-1", firstName: "Ayşe", lastName: "Tekin" },
};

describe("updatePet", () => {
  it("refuses to update a pet outside the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await expect(updatePet("p-x", validInput, ctx)).rejects.toBeInstanceOf(
      AppError,
    );

    expect(vi.mocked(prisma.pet.findFirst).mock.calls[0][0]?.where).toEqual({
      id: "p-x",
      clinicId: "clinic-1",
    });
    expect(vi.mocked(prisma.pet.findFirst).mock.calls[0][0]?.select).toMatchObject({
      birthDate: true,
      weightKg: true,
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
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(storedPet as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    await updatePet("p-1", validInput, ctx);

    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: expect.objectContaining({ name: "Biscuit" }),
    });
  });

  it("stops calling a birth date an estimate once somebody types a different one", async () => {
    const estimated = new Date("2021-01-01T00:00:00Z");
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ ...storedPet, birthDate: estimated } as never);
    await updatePet("p-1", { ...validInput, birthDate: new Date("2021-01-01T00:00:00Z") } as never, ctx);
    expect(vi.mocked(prisma.pet.update).mock.calls[0][0].data).not.toHaveProperty("birthDateEstimated");

    await updatePet("p-1", { ...validInput, birthDate: new Date("2021-06-15T00:00:00Z") } as never, ctx);
    expect(vi.mocked(prisma.pet.update).mock.calls[1][0].data).toMatchObject({ birthDateEstimated: false });
  });
});

// pm B12: an animal moved to another owner silently, and neither
// client's page said so.
describe("updatePet, changing the owner", () => {
  const moved = { ...validInput, ownerId: "owner-2" };

  beforeEach(() => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(storedPet as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({
      id: "owner-2",
      firstName: "Mehmet",
      lastName: "Kaya",
    } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1", ownerId: "owner-2" } as never);
  });

  it("is refused until somebody confirms it", async () => {
    await expect(updatePet("p-1", moved, ctx)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it("writes the same sentence on both owners' timelines, the animal once", async () => {
    await updatePet("p-1", moved, ctx, {
      confirmed: true,
      describe: ({ pet, from, to }) => `Sahip değişti (${pet}): ${from} → ${to}`,
    });
    expect(prisma.note.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          clinicId: "clinic-1",
          clientId: "owner-1",
          petId: null,
          kind: "EVENT",
          body: "Sahip değişti (Fındık): Ayşe Tekin → Mehmet Kaya",
        }),
        expect.objectContaining({
          clientId: "owner-2",
          petId: "p-1",
          body: "Sahip değişti (Fındık): Ayşe Tekin → Mehmet Kaya",
        }),
      ],
    });
  });

  it("moves what is still to come, and leaves the past with who it happened to", async () => {
    await updatePet("p-1", moved, ctx, { confirmed: true });
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ clinicId: "clinic-1", petId: "p-1", clientId: "owner-1" }),
      data: { clientId: "owner-2" },
    });
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "p-1",
        startsAt: { gte: expect.any(Date) },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      }),
      data: { clientId: "owner-2" },
    });
  });

  it("names both owners in the audit entry", async () => {
    await updatePet("p-1", moved, ctx, { confirmed: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({
          owner: {
            from: { id: "owner-1", name: "Ayşe Tekin" },
            to: { id: "owner-2", name: "Mehmet Kaya" },
          },
        }),
      }),
    });
  });

  it("leaves no trace when the owner did not change", async () => {
    await updatePet("p-1", validInput, ctx);
    expect(prisma.note.createMany).not.toHaveBeenCalled();
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

describe("restorePet", () => {
  it("clears archivedAt and records who undid it", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "p-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    const result = await restorePet("p-1", ctx);

    expect(result.ownerId).toBe("owner-1");
    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { archivedAt: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RESTORE", entityType: "Pet" }),
    });
  });

  it("refuses a pet from another clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await expect(restorePet("p-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });
});

// The pet form's weight is dated, so the newer of it and a visit's weight
// is the animal's weight (`weight.ts`).
describe("dating the pet form's weight", () => {
  it("dates a weight entered with a new animal", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({ id: "p-1" } as never);
    await createPet({ ...validInput, weightKg: 4.2 }, ctx);
    expect(vi.mocked(prisma.pet.create).mock.calls[0][0].data.weightRecordedAt).toBeInstanceOf(Date);
  });

  it("re-dates it only when the number changed", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ ...storedPet, weightKg: 4.2 } as never);
    await updatePet("p-1", { ...validInput, weightKg: 4.2 }, ctx);
    expect(vi.mocked(prisma.pet.update).mock.calls[0][0].data).not.toHaveProperty("weightRecordedAt");

    await updatePet("p-1", { ...validInput, weightKg: 4.5 }, ctx);
    expect(vi.mocked(prisma.pet.update).mock.calls[1][0].data.weightRecordedAt).toBeInstanceOf(Date);
  });
});

describe("marking an animal as deceased", () => {
  const now = new Date("2026-10-07T09:00:00.000Z");
  const day = new Date("2026-10-06T21:00:00.000Z"); // 7 Oct, Istanbul midnight

  it("records the day and the note, and audits both", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "p-1", birthDate: null } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    await markPetDeceased("p-1", { deceasedAt: day, deceasedNote: "Evde, yaşlılık" }, ctx, now);

    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { deceased: true, deceasedAt: day, deceasedNote: "Evde, yaşlılık" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "Pet",
        changes: expect.objectContaining({ deceased: true, deceasedNote: "Evde, yaşlılık" }),
      }),
    });
  });

  it("refuses a day in the future, or before the animal was born", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "p-1",
      birthDate: new Date("2026-01-01"),
    } as never);
    await expect(
      markPetDeceased("p-1", { deceasedAt: new Date("2026-10-20"), deceasedNote: null }, ctx, now),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      markPetDeceased("p-1", { deceasedAt: new Date("2025-12-01"), deceasedNote: null }, ctx, now),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it("takes a mistaken mark back, keeping what it said in the audit", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "p-1",
      deceasedAt: day,
      deceasedNote: "yanlış hayvan",
    } as never);
    vi.mocked(prisma.pet.update).mockResolvedValue({ id: "p-1" } as never);

    await unmarkPetDeceased("p-1", ctx);

    expect(prisma.pet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-1", clinicId: "clinic-1", deceased: true } }),
    );
    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { deceased: false, deceasedAt: null, deceasedNote: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "RESTORE",
        metadata: {
          reason: "markedByMistake",
          was: { deceasedAt: day.toISOString(), deceasedNote: "yanlış hayvan" },
        },
      }),
    });
  });
});
