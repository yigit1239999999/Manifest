import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: vi.fn() },
    customSpecies: { findMany: vi.fn() },
    importBatch: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { commitImport, planImport, undoImport, type ImportAnswers } from "./service";

const admin = { clinicId: "clinic-1", userId: "u-1", userName: "A", userRole: "ADMIN" };
// VET_TECH is the role that can record treatments but not create
// clients: half the permission an import needs, which is none of it.
const vetTech = { ...admin, userRole: "VET_TECH" };

/**
 * A transaction client that records what the import asked it to do, so the
 * tests can assert on the SHAPE of the writes -- one `createMany` per table
 * rather than one create per row, a `deleteMany` with relation filters
 * rather than a list of ids. Those are the two properties that decide
 * whether this survives a file with five thousand rows in it, and neither
 * can be seen from the return value.
 */
function fakeTx(overrides: Record<string, unknown> = {}) {
  const tx = {
    importBatch: {
      create: vi.fn().mockResolvedValue({ id: "batch-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    customSpecies: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    client: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    pet: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: unknown) => unknown) =>
    fn(tx)) as never);
  return tx;
}

const MAPPING = {
  0: "client.firstName",
  1: "client.lastName",
  2: "client.phone",
  3: "pet.name",
  4: "pet.species",
} as const;

const answers = (over: Partial<ImportAnswers> = {}): ImportAnswers => ({
  fileName: "liste.xlsx",
  sheetIndex: 0,
  headerRow: false,
  mapping: { ...MAPPING },
  dateOrders: {},
  duplicates: {},
  species: {},
  sex: {},
  ...over,
});

const ROWS = [
  ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kedi"],
  ["Ada", "Kaya", "0532 111 22 33", "Limon", "Kedi"],
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.customSpecies.findMany).mockResolvedValue([] as never);
});

describe("who may run an import", () => {
  it("needs both halves of the permission, because a row is a person and an animal", async () => {
    await expect(planImport(ROWS, answers(), vetTech)).rejects.toBeInstanceOf(AppError);
    await expect(commitImport(ROWS, answers(), vetTech)).rejects.toBeInstanceOf(AppError);
    await expect(undoImport("batch-1", vetTech)).rejects.toBeInstanceOf(AppError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("the plan is read-only", () => {
  it("writes nothing while it counts", async () => {
    const summary = await planImport(ROWS, answers(), admin);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(summary.createCount).toBe(1);
    expect(summary.petCount).toBe(2);
  });

  it("reads the clinic's clients once, not once per row", async () => {
    await planImport(ROWS, answers(), admin);
    expect(prisma.client.findMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.client.findMany).mock.calls[0][0]).toMatchObject({
      where: { clinicId: "clinic-1", archivedAt: null },
    });
  });

  it("offers the species table with the file's own values", async () => {
    const summary = await planImport(ROWS, answers(), admin);
    expect(summary.species.map((s) => s.raw)).toEqual(["Kedi"]);
    expect(summary.species[0].rows).toBe(2);
  });
});

describe("writing", () => {
  it("refuses while a 'same person?' question is unanswered", async () => {
    // The screen blocks on these as well. This is the control: an answer
    // nobody gave may not become a merge because a request got here.
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      { id: "c1", firstName: "Ada", lastName: "Kaya", phone: null, secondaryPhone: null },
    ] as never);
    fakeTx();

    await expect(
      commitImport([["Ada", "Kaya", "", "Boncuk", "Kedi"]], answers(), admin),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates one client for a person with two animals, in one statement each", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    const result = await commitImport(ROWS, answers({ species: speciesAnswer("Kedi") }), admin);

    expect(tx.client.createMany).toHaveBeenCalledTimes(1);
    expect(tx.pet.createMany).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ clientCount: 1, petCount: 2, mergedCount: 0 });

    const clients = tx.client.createMany.mock.calls[0][0].data;
    expect(clients).toHaveLength(1);
    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.map((p: { ownerId: string }) => p.ownerId)).toEqual(["new-1", "new-1"]);
  });

  it("tags every row it creates with the batch, and nothing else", async () => {
    // The whole safety of undo. A client the import merged onto must stay
    // out of reach of "delete the rows of this batch".
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      { id: "c1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33", secondaryPhone: null },
    ] as never);
    const tx = fakeTx();

    const result = await commitImport(ROWS, answers({ species: speciesAnswer("Kedi") }), admin);

    expect(tx.client.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ clientCount: 0, mergedCount: 1, petCount: 2 });
    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.every((p: { importBatchId: string }) => p.importBatchId === "batch-1")).toBe(true);
    expect(pets.every((p: { ownerId: string }) => p.ownerId === "c1")).toBe(true);
  });

  it("never writes that an imported animal is alive", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(ROWS, answers({ species: speciesAnswer("Kedi") }), admin);

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(Object.keys(pets[0])).not.toContain("deceased");
    expect(Object.keys(pets[0])).not.toContain("deceasedAt");
  });

  it("records an unanswered sex value as not known rather than guessing", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kedi", "K"]],
      answers({ mapping: { ...MAPPING, 5: "pet.sex" }, species: speciesAnswer("Kedi") }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].sex).toBe("UNKNOWN");
  });

  it("creates a clinic species once for the whole file, not once per animal", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    tx.customSpecies.findMany.mockResolvedValue([{ id: "cs-1", name: "Kirpi" }]);

    await commitImport(
      [
        ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kirpi"],
        ["Ada", "Kaya", "0532 111 22 33", "Limon", "Kirpi"],
      ],
      answers({ species: { Kirpi: { target: { kind: "newCustom", name: "Kirpi" } } } }),
      admin,
    );

    expect(tx.customSpecies.createMany).toHaveBeenCalledTimes(1);
    expect(tx.customSpecies.createMany.mock.calls[0][0].data).toHaveLength(1);
    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.every((p: { customSpeciesId: string }) => p.customSpeciesId === "cs-1")).toBe(true);
  });
});

describe("undo", () => {
  it("refuses a batch belonging to another clinic", async () => {
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null as never);
    await expect(undoImport("batch-1", admin)).rejects.toBeInstanceOf(AppError);
    expect(vi.mocked(prisma.importBatch.findFirst).mock.calls[0][0]).toMatchObject({
      where: { id: "batch-1", clinicId: "clinic-1" },
    });
  });

  it("refuses to undo the same import twice", async () => {
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({
      id: "batch-1",
      undoneAt: new Date(),
    } as never);
    await expect(undoImport("batch-1", admin)).rejects.toBeInstanceOf(AppError);
  });

  it("leaves behind every animal the clinic has since worked on", async () => {
    // Undo is for regretting an import, not for erasing a morning. The
    // guard is in the statement rather than in a loop, so it holds for a
    // file of five thousand rows as cheaply as for one of five.
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({
      id: "batch-1",
      undoneAt: null,
    } as never);
    const tx = fakeTx();
    tx.pet.count.mockResolvedValue(10);
    tx.pet.deleteMany.mockResolvedValue({ count: 8 });
    tx.client.count.mockResolvedValue(5);
    tx.client.deleteMany.mockResolvedValue({ count: 4 });

    const result = await undoImport("batch-1", admin);

    expect(result).toEqual({ clientCount: 4, petCount: 8, keptClients: 1, keptPets: 2 });
    const petWhere = tx.pet.deleteMany.mock.calls[0][0].where;
    expect(petWhere).toMatchObject({ clinicId: "clinic-1", importBatchId: "batch-1" });
    expect(petWhere.visits).toEqual({ none: {} });
    expect(petWhere.invoiceLines).toEqual({ none: {} });
    const clientWhere = tx.client.deleteMany.mock.calls[0][0].where;
    expect(clientWhere.pets).toEqual({ none: {} });
    expect(clientWhere.invoices).toEqual({ none: {} });
    expect(tx.importBatch.update).toHaveBeenCalled();
  });
});

function speciesAnswer(raw: string) {
  return { [raw]: { target: { kind: "builtIn" as const, key: "CAT" as const } } };
}
