import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    client: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Run interactive transactions against the same mock so call assertions
  // continue to work whether the call went through `prisma.x` or `tx.x`.
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) =>
    cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  archiveClient,
  createClient,
  restoreClient,
  updateClient,
} from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@example.com",
  phone: null,
  secondaryPhone: null,
  address: null,
  city: null,
  postalCode: null,
  country: null,
  preferredContact: null,
  marketingOptIn: false,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  // Keep `prisma.$transaction(cb)` invoking the callback with the mock
  // itself as the transaction client, so per-test mockResolvedValue calls
  // still match whether the code path uses `prisma.x` or `tx.x`.
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
});

describe("createClient", () => {
  it("scopes the created row to the active clinic", async () => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);

    await createClient(validInput, ctx);

    expect(prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clinicId: "clinic-1", firstName: "Jamie" }),
    });
  });

  it("writes an audit entry on success", async () => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);

    await createClient(validInput, ctx);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        action: "CREATE",
        entityType: "Client",
      }),
    });
  });
});

describe("updateClient", () => {
  it("rejects an update for a client outside the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(
      updateClient("c-x", validInput, ctx),
    ).rejects.toBeInstanceOf(AppError);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: "c-x", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("updates a client that belongs to the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await updateClient("c-1", validInput, ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: expect.objectContaining({ firstName: "Jamie" }),
    });
  });
});

describe("archiveClient", () => {
  it("refuses to archive a client outside the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(archiveClient("c-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("sets archivedAt on success and audits the change", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await archiveClient("c-1", ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ARCHIVE", entityType: "Client" }),
    });
  });
});

describe("restoreClient", () => {
  it("clears archivedAt on the matching client", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await restoreClient("c-1", ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { archivedAt: null },
    });
  });
});
