import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: vi.fn() },
    customSpecies: { findMany: vi.fn() },
    clinic: { findUnique: vi.fn() },
    vaccination: { findMany: vi.fn() },
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
/**
 * `createManyAndReturn` hands back one id per row in insertion order; the
 * fake does the same, and is the SAME mock as `createMany`, so the shape
 * assertions below read one statement per table whichever of the two the
 * service calls.
 */
const returning = () =>
  vi.fn().mockImplementation(async ({ data }: { data: unknown[] }) =>
    data.map((_, i) => ({ id: `new-${i + 1}` })),
  );

function fakeTx(overrides: Record<string, unknown> = {}) {
  const clientCreate = returning();
  const petCreate = returning();
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
      createMany: clientCreate,
      createManyAndReturn: clientCreate,
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    pet: {
      createMany: petCreate,
      createManyAndReturn: petCreate,
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    vaccination: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      // `recomputeSuperseded` reads the animals' doses after a write.
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    clinic: { findUnique: vi.fn().mockResolvedValue({ settings: {} }) },
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
  vi.mocked(prisma.clinic.findUnique).mockResolvedValue({ settings: {} } as never);
  vi.mocked(prisma.vaccination.findMany).mockResolvedValue([] as never);
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

  it("writes what the screen showed, for every line the vet did not touch", async () => {
    // The defect this closes: the tables arrive filled in, so agreeing with
    // a line means touching nothing -- and a commit that read only what came
    // back would write every cat as "other" and every "Erkek" as "not
    // known", under a screen that said otherwise.
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kedi", "Erkek"]],
      answers({ mapping: { ...MAPPING, 5: "pet.sex" } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].species).toBe("CAT");
    expect(pets[0].sex).toBe("MALE");
  });

  it("adds an untouched clinic species rather than losing its name", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    tx.customSpecies.findMany.mockResolvedValue([{ id: "cs-1", name: "Kirpi" }]);

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kirpi"]],
      answers(),
      admin,
    );

    expect(tx.customSpecies.createMany).toHaveBeenCalledTimes(1);
    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].species).toBe("OTHER");
    expect(pets[0].customSpeciesId).toBe("cs-1");
  });

  it("keeps a breed the vet emptied empty", async () => {
    // An answer replaces its proposal whole. Merging the two would put the
    // split back after the vet took it off.
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Tekir Kedi"]],
      answers({
        species: { "Tekir Kedi": { target: { kind: "builtIn", key: "CAT" } } },
      }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].breed ?? null).toBeNull();
  });

  it("proposes the split when the vet leaves the line alone", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Tekir Kedi"]],
      answers(),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].species).toBe("CAT");
    expect(pets[0].breed).toBe("Tekir");
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

describe("a species id from the browser", () => {
  const owned = (id: string, name: string) =>
    vi.mocked(prisma.customSpecies.findMany).mockResolvedValue([{ id, name }] as never);

  it("is written when the clinic owns it", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    owned("cs-ours", "Kirpi");

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kirpi"]],
      answers({ species: { Kirpi: { target: { kind: "custom", id: "cs-ours" } } } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].customSpeciesId).toBe("cs-ours");
  });

  it("is refused when it belongs to another clinic", async () => {
    // The same door the bulk answer closed, one field wider: a foreign key
    // says the row exists, not that it is ours. Without the check this
    // writes a pet of THIS clinic pointing at ANOTHER clinic's species --
    // wrong data and a tenancy boundary crossed in one write.
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    owned("cs-ours", "Kirpi");

    await commitImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kirpi"]],
      answers({ species: { Kirpi: { target: { kind: "custom", id: "cs-theirs" } } } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets[0].species).toBe("OTHER");
    expect(pets[0].customSpeciesId).toBeNull();
  });
});

describe("a file with no species column (#42)", () => {
  // No `pet.species` in the mapping, which is the case a clinic that keeps
  // one kind of animal actually has.
  const NO_SPECIES = { 0: "client.firstName", 1: "client.lastName", 2: "client.phone", 3: "pet.name" } as const;
  const noSpecies = (over: Partial<ImportAnswers> = {}) =>
    answers({ mapping: { ...NO_SPECIES }, ...over });
  const BODY = [
    ["Ada", "Kaya", "0532 111 22 33", "Boncuk"],
    ["Ada", "Kaya", "0532 111 22 33", "Limon"],
  ];

  it("has no table to show and says how many rows are waiting on the answer", async () => {
    // Both halves matter, and the second is the reason the bulk question
    // cannot live inside the species table: with no column there are no
    // distinct values, so there is no table -- and the count is the only
    // thing on screen that knows these rows exist.
    const summary = await planImport(BODY, noSpecies(), admin);
    expect(summary.species).toEqual([]);
    expect(summary.speciesUnknownRows).toBe(2);
  });

  it("counts a cell the file left blank the same way the write reads it", async () => {
    // The two have to be the same set or the screen lies: "-" is one of this
    // product's ways of writing "nothing", and `plan.ts` and the enum table
    // both read it that way.
    const summary = await planImport(
      [["Ada", "Kaya", "0532 111 22 33", "Boncuk", "-"]],
      answers(),
      admin,
    );
    expect(summary.species).toEqual([]);
    expect(summary.speciesUnknownRows).toBe(1);
  });

  it("still records them as other when the vet left the question alone", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(BODY, noSpecies(), admin);

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.map((p: { species: string }) => p.species)).toEqual(["OTHER", "OTHER"]);
  });

  it("writes the vet's one answer to every one of those rows", async () => {
    // The defect the task names: the screen knew, and the vet could not say
    // "they are all cats". The assertion is on the WRITE rather than on the
    // screen, because that is where it was lost before.
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      BODY,
      noSpecies({ speciesFallback: { kind: "builtIn", key: "CAT" } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.map((p: { species: string }) => p.species)).toEqual(["CAT", "CAT"]);
    expect(pets.every((p: { customSpeciesId: string | null }) => p.customSpeciesId === null)).toBe(
      true,
    );
  });

  it("can answer with one of the clinic's own species", async () => {
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    // The clinic has to actually own it: an id from outside this list is
    // refused, and the next test is that half.
    vi.mocked(prisma.customSpecies.findMany).mockResolvedValue([
      { id: "cs-9", name: "Kirpi" },
    ] as never);

    await commitImport(BODY, noSpecies({ speciesFallback: { kind: "custom", id: "cs-9" } }), admin);

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.every((p: { species: string }) => p.species === "OTHER")).toBe(true);
    expect(pets.every((p: { customSpeciesId: string }) => p.customSpeciesId === "cs-9")).toBe(true);
  });

  it("refuses a clinic species id that is not this clinic's", async () => {
    // `customSpeciesId` is the one field on a pet that points at a row the
    // clinic owns, and the id arrives from the browser. A foreign key says
    // the row exists somewhere, not that it is ours -- so an id outside the
    // list this request read is no answer, and the rows stay "other".
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);
    vi.mocked(prisma.customSpecies.findMany).mockResolvedValue([
      { id: "cs-ours", name: "Kirpi" },
    ] as never);

    await commitImport(
      BODY,
      noSpecies({ speciesFallback: { kind: "custom", id: "cs-of-another-clinic" } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.every((p: { species: string }) => p.species === "OTHER")).toBe(true);
    expect(pets.every((p: { customSpeciesId: string | null }) => p.customSpeciesId === null)).toBe(
      true,
    );
  });

  it("leaves rows whose species the file DOES give alone", async () => {
    // A mixed file: one row says "Kopek", one says nothing. The answer was
    // about the second only, and a fallback that reached the first would be
    // the product overruling the file.
    const tx = fakeTx();
    tx.client.findMany.mockResolvedValue([
      { id: "new-1", firstName: "Ada", lastName: "Kaya", phone: "0532 111 22 33" },
    ]);

    await commitImport(
      [
        ["Ada", "Kaya", "0532 111 22 33", "Boncuk", "Kopek"],
        ["Ada", "Kaya", "0532 111 22 33", "Limon", ""],
      ],
      answers({ speciesFallback: { kind: "builtIn", key: "CAT" } }),
      admin,
    );

    const pets = tx.pet.createMany.mock.calls[0][0].data;
    expect(pets.map((p: { species: string }) => p.species)).toEqual(["DOG", "CAT"]);
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
    tx.vaccination.deleteMany.mockResolvedValue({ count: 3 });

    const result = await undoImport("batch-1", admin);

    expect(result).toEqual({
      vaccinationCount: 3,
      clientCount: 4,
      petCount: 8,
      keptClients: 1,
      keptPets: 2,
    });
    // The run's own vaccinations go first, by batch: they are what it wrote,
    // and the animals they hang on are only "unused" once they are gone.
    expect(tx.vaccination.deleteMany.mock.calls[0][0].where).toEqual({
      clinicId: "clinic-1",
      importBatchId: "batch-1",
    });
    expect(tx.vaccination.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.pet.deleteMany.mock.invocationCallOrder[0],
    );
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

describe("vaccinations", () => {
  const VAX: ImportAnswers["mapping"] = {
    0: "client.firstName",
    1: "client.phone",
    2: "pet.name",
    3: "pet.species",
    4: "vaccine.column",
    5: "vaccine.column",
  };
  const VAX_ROWS = [["Ayşe Yılmaz", "0532 411 22 33", "Pamuk", "Kedi", "14.04.2025", "20.04.2025"]];
  const vaxAnswers = (over: Partial<ImportAnswers> = {}) =>
    answers({
      mapping: { ...VAX },
      dateOrders: { 4: "dayFirst", 5: "dayFirst" },
      vaccineNames: { "4": "Kuduz", "5": "Karma" },
      ...over,
    });

  it("writes one record per vaccine column, in one statement, tagged with the batch", async () => {
    const tx = fakeTx();
    const result = await commitImport(VAX_ROWS, vaxAnswers(), admin);
    expect(tx.vaccination.createMany).toHaveBeenCalledTimes(1);
    const rows = tx.vaccination.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { name: string }) => r.name)).toEqual(["Kuduz", "Karma"]);
    for (const row of rows) {
      expect(row).toMatchObject({ importBatchId: "batch-1", petId: "new-1", administeredDateOnly: true });
      // A day, stored at noon UTC: the same day in every clinic zone.
      expect(row.administeredAt.toISOString().slice(11, 16)).toBe("12:00");
      // No next date unless the vet asked for one.
      expect(row.nextDueAt).toBeNull();
    }
    expect(result.vaccinationCount).toBe(2);
  });

  it("works out the next dose from the clinic's list only when asked, and says where it came from", async () => {
    const tx = fakeTx();
    await commitImport(VAX_ROWS, vaxAnswers({ nextDueFromList: true }), admin);
    const rows = tx.vaccination.createMany.mock.calls[0][0].data;
    expect(rows[0].nextDueAt.toISOString().slice(0, 10)).toBe("2026-04-14");
    expect(rows[0].nextDueSource).toBe("LIST");
  });

  it("offers the next-dose question in the plan with what each answer does", async () => {
    const summary = await planImport(VAX_ROWS, vaxAnswers(), admin);
    expect(summary.vaccinationCount).toBe(2);
    expect(summary.nextDue?.proposable).toBe(2);
    expect(summary.nextDue?.intervals.map((i) => i.name).sort()).toEqual(["Karma", "Kuduz"]);
    expect(summary.vaccines).toEqual(
      expect.arrayContaining([{ name: "Kuduz", count: 1 }, { name: "Karma", count: 1 }]),
    );
  });

  it("reads the same file twice as nothing new: the animal and its dates are already there", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      {
        id: "c1",
        firstName: "Ayşe Yılmaz",
        lastName: null,
        phone: "0532 411 22 33",
        secondaryPhone: null,
        pets: [{ id: "p1", name: "Pamuk", species: "CAT" }],
      },
    ] as never);
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([
      { petId: "p1", name: "Kuduz", administeredAt: new Date("2025-04-14T12:00:00Z") },
      { petId: "p1", name: "Karma", administeredAt: new Date("2025-04-20T12:00:00Z") },
    ] as never);

    const summary = await planImport(VAX_ROWS, vaxAnswers(), admin);
    expect(summary.existingPetCount).toBe(1);
    expect(summary.petCount).toBe(0);
    expect(summary.vaccinationCount).toBe(0);
    expect(summary.existingVaccinationCount).toBe(2);
    // Said once as a count, not sixty times as rows.
    expect(summary.rows).toEqual([]);

    const tx = fakeTx();
    const result = await commitImport(VAX_ROWS, vaxAnswers(), admin);
    expect(tx.pet.createMany).not.toHaveBeenCalled();
    expect(tx.vaccination.createMany).not.toHaveBeenCalled();
    expect(result.existingPetCount).toBe(1);
  });

  it("adds a new date to an animal the clinic already has", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      {
        id: "c1",
        firstName: "Ayşe Yılmaz",
        lastName: null,
        phone: "0532 411 22 33",
        secondaryPhone: null,
        pets: [{ id: "p1", name: "Pamuk", species: "CAT" }],
      },
    ] as never);
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([
      { petId: "p1", name: "Kuduz", administeredAt: new Date("2025-04-14T12:00:00Z") },
    ] as never);
    const tx = fakeTx();
    await commitImport(VAX_ROWS, vaxAnswers(), admin);
    const rows = tx.vaccination.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ petId: "p1", name: "Karma" });
  });
});

describe("dueCounts uses the dashboard's window", () => {
  it("splits overdue at six months and counts the next thirty days", async () => {
    const { dueCounts } = await import("./service");
    const now = new Date("2026-10-03T09:00:00Z");
    expect(
      dueCounts(
        [
          new Date("2026-09-01T12:00:00Z"),
          new Date("2025-10-02T12:00:00Z"),
          new Date("2026-10-20T12:00:00Z"),
          new Date("2027-01-01T12:00:00Z"),
        ],
        now,
      ),
    ).toEqual({ overdue: 1, overdueOlder: 1, dueSoon: 1 });
  });
});
