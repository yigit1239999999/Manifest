import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    diagnostic: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    pet: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDiagnostic, deleteDiagnostic, markDiagnosticRead } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VET_TECH",
};

const validInput = {
  petId: "pet-1",
  visitId: null,
  type: "BLOOD" as const,
  name: "CBC",
  performedAt: new Date("2026-05-22T10:00:00.000Z"),
  result: null,
  interpretation: null,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createDiagnostic", () => {
  it("denies RECEPTIONIST", async () => {
    await expect(
      createDiagnostic(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.diagnostic.create).not.toHaveBeenCalled();
  });

  it("rejects when the pet isn't in the clinic", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue(null);
    await expect(createDiagnostic(validInput, ctx)).rejects.toBeInstanceOf(AppError);
  });

  it("persists with clinicId and the structured fields", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.diagnostic.create).mockResolvedValue({ id: "d-1", petId: "pet-1" } as never);

    await createDiagnostic(validInput, ctx);

    expect(prisma.diagnostic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        type: "BLOOD",
        name: "CBC",
      }),
    });
  });
});

describe("deleteDiagnostic", () => {
  it("rejects rows from another clinic", async () => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue(null);
    await expect(deleteDiagnostic("d-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.diagnostic.delete).not.toHaveBeenCalled();
  });

  it("deletes and audits", async () => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue({
      id: "d-1",
      petId: "pet-1",
    } as never);
    vi.mocked(prisma.diagnostic.delete).mockResolvedValue({} as never);

    await deleteDiagnostic("d-1", ctx);

    expect(prisma.diagnostic.delete).toHaveBeenCalledWith({ where: { id: "d-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE", entityType: "Diagnostic" }),
    });
  });
});


// The marker has exactly one meaning -- did the person who decides
// see this? -- so anybody else clearing it makes it stop answering
// its own question. A technician enters results; that is a different
// act from saying a vet has read one.
describe("who may say a result has been read", () => {
  const vet = { ...ctx, userRole: "VETERINARIAN", userId: "vet-1" };

  beforeEach(() => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue({
      id: "d-1",
      petId: "pet-1",
      readAt: null,
    } as never);
  });

  it("refuses a technician, who may still enter the result itself", async () => {
    await expect(markDiagnosticRead("d-1", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.diagnostic.update).not.toHaveBeenCalled();
  });

  it("records who saw it and when", async () => {
    await markDiagnosticRead("d-1", vet);

    const data = vi.mocked(prisma.diagnostic.update).mock.calls[0][0].data as {
      readById: string;
      readAt: Date;
    };
    expect(data.readById).toBe("vet-1");
    expect(data.readAt).toBeInstanceOf(Date);
  });

  // The question is when it first reached somebody who could act, not
  // who looked at it most recently.
  it("keeps the first reader when marked again", async () => {
    vi.mocked(prisma.diagnostic.findFirst).mockResolvedValue({
      id: "d-1",
      petId: "pet-1",
      readAt: new Date("2026-09-20T08:00:00.000Z"),
    } as never);

    await markDiagnosticRead("d-1", vet);

    expect(prisma.diagnostic.update).not.toHaveBeenCalled();
  });

  // Writing a comment is reading, so interpretation sits behind the
  // same gate -- otherwise the marker could be cleared through a back
  // door by the people the front door excludes.
  it("refuses a technician writing an interpretation, and marks the vet's as read", async () => {
    await expect(
      createDiagnostic({ ...validInput, interpretation: "Grade II" }, ctx),
    ).rejects.toBeInstanceOf(AppError);

    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.diagnostic.create).mockResolvedValue({ id: "d-2", name: "CBC", type: "BLOOD" } as never);

    await createDiagnostic({ ...validInput, interpretation: "Grade II" }, vet);

    const data = vi.mocked(prisma.diagnostic.create).mock.calls[0][0].data as {
      readById: string | null;
      readAt: Date | null;
    };
    expect(data.readById).toBe("vet-1");
    expect(data.readAt).toBeInstanceOf(Date);
  });

  it("leaves a result with no comment unread", async () => {
    // "Read" means seen, not interpreted. Requiring a comment would
    // leave every result that needs none unread for ever.
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({ id: "pet-1" } as never);
    vi.mocked(prisma.diagnostic.create).mockResolvedValue({ id: "d-3", name: "CBC", type: "BLOOD" } as never);

    await createDiagnostic(validInput, vet);

    const data = vi.mocked(prisma.diagnostic.create).mock.calls[0][0].data as {
      readAt: Date | null;
    };
    expect(data.readAt).toBeNull();
  });
});
