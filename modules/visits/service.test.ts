import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    visit: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    pet: { findFirst: vi.fn(), create: vi.fn() },
    client: { findFirst: vi.fn(), create: vi.fn() },
    customSpecies: { findFirst: vi.fn(), create: vi.fn() },
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
  createVisitWithIntake,
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

// "A form has no order, a walk does." At the counter the owner is
// standing there and the animal is not on file; on the examination
// table the animal is in front of the vet and the owner is a name
// nobody has asked for. The product used to ask for whichever one they
// did not have, first, on a screen of its own -- and what the vet
// objected to after walking that chain was not its length but its
// ORDER.
describe("a visit that brings its animal with it", () => {
  const intake = {
    ...validInput,
    petId: null,
    newPet: {
      name: "Ceviz",
      species: "CAT",
      ownerId: null,
      owner: {
        firstName: "Yonca",
        lastName: "Demir",
        phone: "0532 111 22 33",
        consent: true,
      },
    },
  };

  beforeEach(() => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-9" } as never);
    vi.mocked(prisma.pet.create).mockResolvedValue({
      id: "p-9",
      ownerId: "c-9",
    } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({
      id: "v-9",
      petId: "p-9",
      clientId: "c-9",
    } as never);
  });

  it("makes the client, the animal and the visit in one transaction", async () => {
    // Atomicity is the requirement, not a particular number of
    // statements: what must never exist is an animal on file whose
    // visit was never written because a second screen was never
    // reached.
    await createVisitWithIntake(intake, ctx);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.client.create).toHaveBeenCalledTimes(1);
    expect(prisma.pet.create).toHaveBeenCalledTimes(1);
    expect(prisma.visit.create).toHaveBeenCalledTimes(1);
  });

  it("hangs the visit on the owner of the animal, not on anything the form said", async () => {
    await createVisitWithIntake(intake, ctx);

    const visit = vi.mocked(prisma.visit.create).mock.calls[0][0] as {
      data: { petId: string; clientId: string; clinicId: string };
    };
    expect(visit.data).toMatchObject({
      petId: "p-9",
      clientId: "c-9",
      clinicId: "clinic-1",
    });
  });

  // Not asked on this screen -- the vet was asked what else has to be
  // captured while the animal is on the table and said there is
  // nothing. `UNKNOWN` is the value the enum already has for that.
  it("records a sex nobody was asked for as unknown", async () => {
    await createVisitWithIntake(intake, ctx);

    expect(vi.mocked(prisma.pet.create).mock.calls[0][0]).toMatchObject({
      data: { sex: "UNKNOWN", name: "Ceviz", clinicId: "clinic-1" },
    });
  });

  // Three records born in one breath are still three records: a trail
  // that mentions only the visit cannot answer "where did this client
  // come from".
  it("writes one audit row per record that was born", async () => {
    await createVisitWithIntake(intake, ctx);

    const entities = vi
      .mocked(prisma.auditLog.create)
      .mock.calls.map((c) => (c[0] as { data: { entityType: string } }).data.entityType);
    expect(entities).toEqual(["Pet", "Client", "Visit"]);
  });

  it("names what it made, so the screen can say it back", async () => {
    const made = await createVisitWithIntake(intake, ctx);

    expect(made).toMatchObject({
      id: "v-9",
      createdPet: { id: "p-9", name: "Ceviz" },
      createdClient: { id: "c-9", firstName: "Yonca", lastName: "Demir" },
    });
  });

  it("says nothing was made when the animal was already on file", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "c-1",
    } as never);
    vi.mocked(prisma.visit.create).mockResolvedValue({
      id: "v-1",
      petId: "pet-1",
      clientId: "c-1",
    } as never);

    const made = await createVisitWithIntake(
      { ...validInput, petId: "pet-1", newPet: undefined },
      ctx,
    );

    expect(made.createdPet).toBeNull();
    expect(made.createdClient).toBeNull();
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  it("uses an owner already on file rather than making a second one", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);

    await createVisitWithIntake(
      {
        ...intake,
        newPet: { ...intake.newPet, ownerId: "c-1", owner: undefined },
      },
      ctx,
    );

    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.pet.create).mock.calls[0][0]).toMatchObject({
      data: { ownerId: "c-1" },
    });
  });

  // `connect` on its own would take an id from any clinic.
  it("refuses an owner id that belongs to another clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(
      createVisitWithIntake(
        {
          ...intake,
          newPet: { ...intake.newPet, ownerId: "c-elsewhere", owner: undefined },
        },
        ctx,
      ),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  // A technician may not write visits at all, so nothing is made.
  //
  // What this does NOT prove, and the service says so on purpose: that
  // the second and third permission checks work. No role today holds
  // `visits.write` without `clients.write`, so no test can separate
  // them from here -- the checks are written out one per record
  // because the appointment side of this walk has a DIFFERENT set
  // (reception may write clients and animals but not visits), and a
  // single copied line would be wrong there rather than here.
  it("creates nothing for a reader who may not write visits", async () => {
    await expect(
      createVisitWithIntake(intake, { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.pet.create).not.toHaveBeenCalled();
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });
});
