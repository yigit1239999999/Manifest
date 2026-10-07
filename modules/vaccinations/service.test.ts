import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    vaccination: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(),
    },
    pet: { findFirst: vi.fn(), findMany: vi.fn(async () => []) },
    clinic: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createVaccination, deleteVaccination, setVaccineSettings } from "./service";

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
  doseNumber: null,
  seriesOf: null,
  nextDueSource: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createVaccination", () => {
  it("will not record where a date came from when there is no date", async () => {
    // A source without a date claims a provenance for something that is
    // not there, and reads six months later as a schedule somebody
    // deleted. The pair travels together or not at all.
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.vaccination.create).mockResolvedValue({ id: "v-1", petId: "pet-1" } as never);

    await createVaccination({ ...validInput, nextDueSource: "LIST" }, ctx);

    expect(prisma.vaccination.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nextDueAt: null, nextDueSource: null }),
    });
  });

  it("records the dose and the source the screen showed", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.vaccination.create).mockResolvedValue({ id: "v-1", petId: "pet-1" } as never);

    await createVaccination(
      {
        ...validInput,
        nextDueAt: new Date("2027-05-22T10:00:00.000Z"),
        nextDueSource: "LIST",
        doseNumber: 2,
        seriesOf: 3,
      },
      ctx,
    );

    expect(prisma.vaccination.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nextDueSource: "LIST",
        doseNumber: 2,
        seriesOf: 3,
      }),
    });
  });

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

describe("setVaccineSettings", () => {
  const admin = { ...ctx, userRole: "ADMIN" };

  it("is settings-manage only, like every other list on that screen", async () => {
    await expect(
      setVaccineSettings({ hidden: [], intervals: {}, added: [] }, ctx),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.clinic.update).not.toHaveBeenCalled();
  });

  it("keeps the clinic's other settings and drops what it cannot read", async () => {
    // Two rules in one save. The merge is the one every settings writer
    // here has to get right; the normalisation is why a half-readable
    // override cannot become a proposed date later.
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      settings: { enabledSpecies: ["DOG"], timezone: "Europe/Istanbul" },
    } as never);
    vi.mocked(prisma.clinic.update).mockResolvedValue({} as never);

    await setVaccineSettings(
      {
        hidden: ["dog.kennelCough"],
        intervals: { "dog.rabies": { unit: "fortnight", value: 2 } } as never,
        added: [{ species: "DOG", name: "Leishmania" }],
      },
      admin,
    );

    expect(prisma.clinic.update).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: {
        settings: {
          enabledSpecies: ["DOG"],
          timezone: "Europe/Istanbul",
          vaccines: {
            hidden: ["dog.kennelCough"],
            intervals: {},
            added: [{ species: "DOG", name: "Leishmania" }],
          },
        },
      },
    });
  });
});

describe("createVaccination: a second press of save", () => {
  it("refuses the same vaccine for the same animal in the same minute", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.vaccination.findFirst).mockResolvedValue({ id: "v-1" } as never);

    const err = await createVaccination(
      {
        petId: "pet-1",
        visitId: null,
        administeredById: null,
        name: "Lyme",
        manufacturer: null,
        lotNumber: null,
        site: null,
        administeredAt: new Date("2026-10-07T05:40:31.000Z"),
        nextDueAt: null,
        nextDueSource: null,
        doseNumber: null,
        seriesOf: null,
        notes: null,
      } as never,
      { clinicId: "clinic-1", userId: "user-1", userName: "T", userRole: "VETERINARIAN" },
    ).catch((e) => e);
    expect(err.messageKey).toBe("error.conflict.duplicateRecord");
    expect(err.messageVars).toEqual({ name: "Lyme" });
    expect(vi.mocked(prisma.vaccination.findFirst).mock.calls[0][0]).toMatchObject({
      where: {
        administeredAt: {
          gte: new Date("2026-10-07T05:40:00.000Z"),
          lt: new Date("2026-10-07T05:41:00.000Z"),
        },
      },
    });
    expect(prisma.vaccination.create).not.toHaveBeenCalled();
  });
});

describe("createVaccination for an animal that has died", () => {
  it("refuses a dose after the day of death", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      deceased: true,
      deceasedAt: new Date("2026-05-01T21:00:00.000Z"),
    } as never);
    const err = await createVaccination(validInput, ctx).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.details.fieldErrors).toEqual({ administeredAt: ["error.validation.afterDeath"] });
    expect(prisma.vaccination.create).not.toHaveBeenCalled();
  });
});
