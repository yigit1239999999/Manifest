import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    client: { findMany: vi.fn(), createMany: vi.fn() },
    pet: { findMany: vi.fn(), createMany: vi.fn() },
    vaccination: { createMany: vi.fn() },
    customSpecies: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    clinic: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { commitImport, inspectImport, previewImport } from "./service";

const ctx = { clinicId: "clinic-1", userId: "user-1", userName: "Test", userRole: "ADMIN" };

const HEADER = "Sahip Adı;Telefon;Hayvan Adı;Tür;Doğum Tarihi;Son Aşı;Son Aşı Tarihi";
const csv = (...lines: string[]) =>
  new File([new TextEncoder().encode([HEADER, ...lines].join("\n"))], "liste.csv");

const FILE = () =>
  csv(
    "Ayşe Yılmaz;0532 123 45 67;Pamuk;Kedi;12.05.2021;Karma;10.03.2026",
    "Ayşe Yılmaz;+90 532 123 4567;Karabaş;Köpek;03.09.2019;;",
    "Mehmet Kaya;0533 222 22 22;Boncuk;Kedi;;;",
    ";;Sahipsiz;Kedi;;;",
  );

const MAPPING = ["ownerName", "phone", "petName", "species", "birthDate", "vaccineName", "vaccineDate"];
const OPTIONS = { dateOrder: null, speciesChoices: {} };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: unknown) => (cb as (tx: typeof prisma) => Promise<unknown>)(prisma),
  );
  vi.mocked(prisma.client.findMany).mockResolvedValue([]);
  vi.mocked(prisma.pet.findMany).mockResolvedValue([]);
  vi.mocked(prisma.customSpecies.findMany).mockResolvedValue([]);
});

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof AppError) return (e.details?.importError as string) ?? e.code;
    throw e;
  }
  return null;
}

describe("who may import", () => {
  it("refuses every role but the clinic's administrator, before reading anything", async () => {
    for (const role of ["VETERINARIAN", "VET_TECH", "RECEPTIONIST"]) {
      expect(await refusal(inspectImport(FILE(), { ...ctx, userRole: role }))).toBe("FORBIDDEN");
      expect(
        await refusal(commitImport(FILE(), MAPPING, OPTIONS, {}, { ...ctx, userRole: role })),
      ).toBe("FORBIDDEN");
    }
    expect(prisma.client.findMany).not.toHaveBeenCalled();
    expect(prisma.client.createMany).not.toHaveBeenCalled();
  });
});

describe("inspectImport", () => {
  it("returns the headers, sample values and a suggested mapping", async () => {
    const result = await inspectImport(FILE(), ctx);
    expect(result.headers[0]).toBe("Sahip Adı");
    expect(result.mapping).toEqual(MAPPING);
    expect(result.samples[2]).toEqual(["Pamuk", "Karabaş", "Boncuk"]);
    expect(result.rows).toBe(4);
  });
});

describe("previewImport", () => {
  it("reads the clinic's records and nobody else's", async () => {
    await previewImport(FILE(), MAPPING, OPTIONS, ctx);
    expect(vi.mocked(prisma.client.findMany).mock.calls[0][0]?.where).toEqual({ clinicId: "clinic-1" });
    expect(vi.mocked(prisma.customSpecies.findMany).mock.calls[0][0]?.where).toEqual({
      clinicId: "clinic-1",
    });
  });

  it("refuses until the required columns are mapped", async () => {
    expect(await refusal(previewImport(FILE(), ["ownerName", "phone"], OPTIONS, ctx))).toBe(
      "mappingIncomplete",
    );
  });

  it("hands back the original cells of the rows it will skip, for the report", async () => {
    const { skippedCells, analysis } = await previewImport(FILE(), MAPPING, OPTIONS, ctx);
    expect(analysis.counts).toMatchObject({ pets: 3, newClients: 2, skipped: 1 });
    expect(skippedCells).toEqual({ 5: ["", "", "Sahipsiz", "Kedi", "", "", ""] });
  });
});

describe("commitImport", () => {
  const expected = { pets: 3, newClients: 2, existingClients: 0, vaccinations: 1 };

  it("writes every row into the session's clinic, whatever the request says", async () => {
    await commitImport(FILE(), MAPPING, { ...OPTIONS, clinicId: "clinic-2" }, expected, ctx);

    const clients = vi.mocked(prisma.client.createMany).mock.calls.flatMap((c) => c[0]!.data as object[]);
    const pets = vi.mocked(prisma.pet.createMany).mock.calls.flatMap((c) => c[0]!.data as object[]);
    const vaccinations = vi
      .mocked(prisma.vaccination.createMany)
      .mock.calls.flatMap((c) => c[0]!.data as object[]);
    expect(clients).toHaveLength(2);
    expect(pets).toHaveLength(3);
    expect(vaccinations).toHaveLength(1);
    for (const row of [...clients, ...pets, ...vaccinations])
      expect(row).toMatchObject({ clinicId: "clinic-1" });
  });

  it("creates one client per owner, however their number was written", async () => {
    await commitImport(FILE(), MAPPING, OPTIONS, expected, ctx);
    const clients = vi.mocked(prisma.client.createMany).mock.calls[0][0]!.data as {
      id: string;
      firstName: string;
      phone: string;
    }[];
    expect(clients.map((c) => [c.firstName, c.phone])).toEqual([
      ["Ayşe", "0532 123 45 67"],
      ["Mehmet", "0533 222 22 22"],
    ]);
    const pets = vi.mocked(prisma.pet.createMany).mock.calls[0][0]!.data as {
      name: string;
      ownerId: string;
    }[];
    expect(pets.filter((p) => p.ownerId === clients[0].id).map((p) => p.name)).toEqual([
      "Pamuk",
      "Karabaş",
    ]);
  });

  it("records no messaging consent: not asked, rather than refused or given", async () => {
    await commitImport(FILE(), MAPPING, OPTIONS, expected, ctx);
    const clients = vi.mocked(prisma.client.createMany).mock.calls[0][0]!.data as {
      notificationsOptIn: unknown;
    }[];
    for (const c of clients) expect(c.notificationsOptIn).toBeNull();
  });

  it("adds animals to a client that already exists instead of creating a twin", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      {
        id: "client-ayse",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "05321234567",
        secondaryPhone: null,
        email: null,
        archivedAt: null,
      },
    ] as never);
    vi.mocked(prisma.pet.findMany).mockResolvedValue([
      { ownerId: "client-ayse", name: "Pamuk", microchipId: null },
    ] as never);

    const result = await commitImport(
      FILE(),
      MAPPING,
      OPTIONS,
      { pets: 2, newClients: 1, existingClients: 1, vaccinations: 0 },
      ctx,
    );

    // Pamuk is already there and is skipped; Karabaş joins Ayşe's record.
    expect(vi.mocked(prisma.pet.findMany).mock.calls[0][0]?.where).toMatchObject({
      clinicId: "clinic-1",
      OR: [{ ownerId: { in: ["client-ayse"] } }],
    });
    const clients = vi.mocked(prisma.client.createMany).mock.calls[0][0]!.data as { firstName: string }[];
    expect(clients.map((c) => c.firstName)).toEqual(["Mehmet"]);
    const pets = vi.mocked(prisma.pet.createMany).mock.calls[0][0]!.data as {
      name: string;
      ownerId: string;
    }[];
    expect(pets.find((p) => p.name === "Karabaş")?.ownerId).toBe("client-ayse");
    expect(pets.map((p) => p.name)).not.toContain("Pamuk");
    expect(result).toMatchObject({ pets: 2, newClients: 1, existingClients: 1 });
  });

  it("writes nothing when the result no longer matches what was previewed", async () => {
    expect(
      await refusal(commitImport(FILE(), MAPPING, OPTIONS, { ...expected, pets: 4 }, ctx)),
    ).toBe("changedSincePreview");
    expect(await refusal(commitImport(FILE(), MAPPING, OPTIONS, null, ctx))).toBe(
      "changedSincePreview",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("writes an audit row for the import and for each record it created", async () => {
    const result = await commitImport(FILE(), MAPPING, OPTIONS, expected, ctx);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        actorId: "user-1",
        action: "CREATE",
        entityType: "Import",
        entityId: result.importId,
        metadata: expect.objectContaining({ fileName: "liste.csv", pets: 3, newClients: 2, skipped: 1 }),
      }),
    });
    const perRecord = vi.mocked(prisma.auditLog.createMany).mock.calls[0][0]!.data as {
      entityType: string;
      clinicId: string;
    }[];
    expect(perRecord.map((r) => r.entityType).sort()).toEqual([
      "Client",
      "Client",
      "Pet",
      "Pet",
      "Pet",
      "Vaccination",
    ]);
    expect(perRecord.every((r) => r.clinicId === "clinic-1")).toBe(true);
  });

  it("creates a species the clinic agreed to add once, inside the clinic", async () => {
    vi.mocked(prisma.customSpecies.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customSpecies.create).mockResolvedValue({ id: "cs-new" } as never);
    const file = csv(
      "Ayşe Yılmaz;0532 123 45 67;Maviş;Muhabbet kuşu;;;",
      "Ayşe Yılmaz;0532 123 45 67;Limon;muhabbet kusu;;;",
    );
    await commitImport(file, MAPPING, OPTIONS, { pets: 2, newClients: 1, existingClients: 0, vaccinations: 0 }, ctx);

    expect(prisma.customSpecies.create).toHaveBeenCalledTimes(1);
    expect(prisma.customSpecies.create).toHaveBeenCalledWith({
      data: { clinicId: "clinic-1", name: "Muhabbet kuşu" },
      select: { id: true },
    });
    const pets = vi.mocked(prisma.pet.createMany).mock.calls[0][0]!.data as {
      species: string;
      customSpeciesId: string;
    }[];
    expect(pets.every((p) => p.species === "OTHER" && p.customSpeciesId === "cs-new")).toBe(true);
  });
});
