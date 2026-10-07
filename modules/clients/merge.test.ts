import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const table = () => ({ count: vi.fn(), updateMany: vi.fn() });
  const prismaMock = {
    client: { findFirst: vi.fn(), update: vi.fn() },
    pet: table(),
    visit: table(),
    appointment: table(),
    invoice: table(),
    reminder: table(),
    note: table(),
    document: table(),
    messageLog: table(),
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { CLIENT_REFERENCES, mergeClients, mergePreview } from "./merge";

const admin = { clinicId: "clinic-1", userId: "u-1", userName: "A", userRole: "ADMIN" };

function client(over: Record<string, unknown> = {}) {
  return {
    id: "c-dup",
    clinicId: "clinic-1",
    firstName: "Ayşe",
    lastName: "Tekin",
    email: null,
    phone: "0532 411 22 33",
    secondaryPhone: null,
    address: null,
    city: null,
    postalCode: null,
    country: null,
    preferredContact: null,
    preferredLanguage: null,
    notificationsOptIn: null,
    notificationsOptInAt: null,
    notificationsOptInSource: null,
    notes: null,
    archivedAt: null,
    ...over,
  };
}

const delegates = () =>
  CLIENT_REFERENCES.map(({ model }) => (prisma as unknown as Record<string, { updateMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }>)[model]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  for (const d of delegates()) {
    d.updateMany.mockResolvedValue({ count: 2 });
    d.count.mockResolvedValue(2);
  }
  vi.mocked(prisma.client.findFirst).mockImplementation((async (args: {
    where: { id: string; clinicId: string };
  }) => {
    if (args.where.clinicId !== "clinic-1") return null;
    if (args.where.id === "c-dup") return client();
    if (args.where.id === "c-keep")
      return client({ id: "c-keep", phone: "0532 999 88 77", email: "ayse@ornek.com", notes: "VIP" });
    return null;
  }) as never);
});

// "Nothing orphaned" is a property of the list, so the list is checked
// against the schema rather than against itself: a model that gains a
// relation to Client and is not added to CLIENT_REFERENCES would keep
// pointing at the archived duplicate after every merge.
describe("CLIENT_REFERENCES", () => {
  it("covers every relation the schema has to Client", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
    const pointing = models
      .filter(([, name, body]) =>
        name !== "Client" && /^\s+\w+\s+Client\??\s+@relation\(/m.test(body),
      )
      .map(([, name, body]) => {
        const column = body.match(/^\s+\w+\s+Client\??\s+@relation\(fields: \[(\w+)\]/m)?.[1];
        return `${name[0].toLowerCase()}${name.slice(1)}.${column}`;
      })
      .sort();
    const listed = CLIENT_REFERENCES.map((r) => `${r.model}.${r.column}`).sort();
    expect(listed).toEqual(pointing);
  });
});

describe("mergeClients", () => {
  it("moves every reference, scoped to the clinic and the duplicate", async () => {
    const { counts } = await mergeClients("c-dup", "c-keep", admin);
    for (const { model, column, key } of CLIENT_REFERENCES) {
      const d = (prisma as unknown as Record<string, { updateMany: ReturnType<typeof vi.fn> }>)[model];
      expect(d.updateMany).toHaveBeenCalledWith({
        where: { clinicId: "clinic-1", [column]: "c-dup" },
        data: { [column]: "c-keep" },
      });
      expect(counts[key]).toBe(2);
    }
  });

  it("archives the emptied record and audits both sides", async () => {
    await mergeClients("c-dup", "c-keep", admin);
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-dup" },
      data: { archivedAt: expect.any(Date) },
    });
    const entries = vi.mocked(prisma.auditLog.create).mock.calls.map((c) => c[0].data);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: "c-keep", action: "UPDATE" }),
        expect.objectContaining({ entityId: "c-dup", action: "ARCHIVE" }),
      ]),
    );
  });

  it("fills what the kept record lacks and never overwrites what it has", async () => {
    vi.mocked(prisma.client.findFirst).mockImplementation((async (args: {
      where: { id: string };
    }) =>
      args.where.id === "c-dup"
        ? client({ email: "other@ornek.com", city: "İzmir", notes: "Kedisi ısırır" })
        : client({ id: "c-keep", phone: "0532 999 88 77", email: "ayse@ornek.com", notes: "VIP" })) as never);
    await mergeClients("c-dup", "c-keep", admin);
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-keep" },
      data: {
        city: "İzmir",
        // The duplicate's number is not lost with it.
        secondaryPhone: "0532 411 22 33",
        notes: "VIP\n\nKedisi ısırır",
      },
    });
  });

  it("does not copy the same number written another way as a second one", async () => {
    vi.mocked(prisma.client.findFirst).mockImplementation((async (args: {
      where: { id: string };
    }) =>
      args.where.id === "c-dup"
        ? client({ phone: "05324112233" })
        : client({ id: "c-keep" })) as never);
    await mergeClients("c-dup", "c-keep", admin);
    expect(prisma.client.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c-keep" } }),
    );
  });

  it("does not reach into another clinic", async () => {
    await expect(
      mergeClients("c-dup", "c-keep", { ...admin, clinicId: "clinic-2" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const d of delegates()) expect(d.updateMany).not.toHaveBeenCalled();
  });

  it("is for administrators only", async () => {
    await expect(
      mergeClients("c-dup", "c-keep", { ...admin, userRole: "VETERINARIAN" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mergeClients("c-dup", "c-keep", { ...admin, userRole: "RECEPTIONIST" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a record merged with itself, or into an archived one", async () => {
    await expect(mergeClients("c-dup", "c-dup", admin)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    vi.mocked(prisma.client.findFirst).mockImplementation((async (args: {
      where: { id: string };
    }) =>
      args.where.id === "c-dup"
        ? client()
        : client({ id: "c-keep", archivedAt: new Date() })) as never);
    await expect(mergeClients("c-dup", "c-keep", admin)).rejects.toMatchObject({
      messageKey: "error.validation.mergeIntoArchived",
    });
  });
});

describe("mergePreview", () => {
  it("counts what would move, per table, without moving it", async () => {
    const { counts, source, target } = await mergePreview("c-dup", "c-keep", admin);
    expect(counts.pets).toBe(2);
    expect(source).toBe("Ayşe Tekin");
    expect(target).toBe("Ayşe Tekin");
    for (const d of delegates()) expect(d.updateMany).not.toHaveBeenCalled();
  });
});
