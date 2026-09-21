import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    visit: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    pet: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    clinic: { findUnique: vi.fn() },
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
  archiveVisit,
  createVisit,
  restoreVisit,
  updateVisit,
} from "./service";

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
  total: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
    currency: "TRY",
  } as never);
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
});

describe("createVisit", () => {
  it("rejects a visit on a pet from another clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);

    await expect(createVisit(validInput, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it("derives clientId from the pet's owner, and leaves the vet unrecorded", async () => {
    // This used to fall back to `ctx.userId`, so leaving the field blank
    // made whoever typed the visit up its clinician — a receptionist
    // writing up yesterday's work became the vet who performed it, in a
    // field nobody ever goes back to correct. Unrecorded is the honest
    // answer; who entered it is in the audit trail regardless.
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
        vetId: null,
      }),
    });
  });

  // The screens offer only clinicians, and a screen's filter is not a
  // rule: a stale tab, a replayed submit or the next screen someone writes
  // all get past it. What this field says is who treated the animal.
  it("records a vet the clinic recognises", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "vet-1" } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({ id: "v-1" } as never);

    await createVisit({ ...validInput, vetId: "vet-1" }, ctx);

    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vetId: "vet-1" }),
    });
  });

  it("refuses one it does not", async () => {
    // `findFirst` returns null for a receptionist, a vet tech, a
    // deactivated user, or someone from another clinic — the query asks
    // all four questions at once.
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(
      createVisit({ ...validInput, vetId: "reception-1" }, ctx),
    ).rejects.toMatchObject({
      details: { fieldErrors: { vetId: ["error.validation.vetRequired"] } },
    });
    expect(prisma.visit.create).not.toHaveBeenCalled();
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

describe("archiveVisit", () => {
  it("stamps archivedAt and records it", async () => {
    vi.mocked(prisma.visit.findFirst).mockResolvedValue({
      id: "v-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.visit.update).mockResolvedValue({ id: "v-1" } as never);

    const result = await archiveVisit("v-1", ctx);

    expect(result.petId).toBe("pet-1");
    expect(prisma.visit.update).toHaveBeenCalledWith({
      where: { id: "v-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ARCHIVE", entityType: "Visit" }),
    });
  });
});

describe("restoreVisit", () => {
  it("clears archivedAt and records who undid it", async () => {
    vi.mocked(prisma.visit.findFirst).mockResolvedValue({
      id: "v-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.visit.update).mockResolvedValue({ id: "v-1" } as never);

    const result = await restoreVisit("v-1", ctx);

    expect(result.petId).toBe("pet-1");
    expect(prisma.visit.update).toHaveBeenCalledWith({
      where: { id: "v-1" },
      data: { archivedAt: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RESTORE", entityType: "Visit" }),
    });
  });

  it("refuses a visit from another clinic", async () => {
    vi.mocked(prisma.visit.findFirst).mockResolvedValue(null);

    await expect(restoreVisit("v-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.visit.update).not.toHaveBeenCalled();
  });

  // A visit's total was printed against the clinic's *current* currency,
  // so the first clinic to switch from dollars to lira restated every
  // visit it had ever recorded. Invoices were given their own currency for
  // this reason; the visit total looked like a plain number and was
  // missed, because the scan at the time was for money being *summed*.
  it("stamps the currency the total was recorded in", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({ id: "v-1" } as never);

    await createVisit({ ...validInput, total: 25_000 }, ctx);

    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalCents: 25_000, currency: "TRY" }),
    });
  });

  it("records no currency when there is no total", async () => {
    // The pair is the point: a currency with no amount says nothing, and
    // an amount with no currency is the defect itself.
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({ id: "v-1" } as never);

    await createVisit({ ...validInput, total: null }, ctx);

    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalCents: null, currency: null }),
    });
  });
});
