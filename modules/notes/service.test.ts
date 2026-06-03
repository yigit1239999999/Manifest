import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    note: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pet: { findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createNote, deleteNote, togglePinned } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "VETERINARIAN",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createNote", () => {
  it("requires either a petId or a clientId", async () => {
    await expect(
      createNote(
        {
          petId: null,
          clientId: null,
          kind: "GENERAL",
          body: "hi",
          pinned: false,
        },
        ctx,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("auto-fills clientId from the pet's owner when only petId is supplied", async () => {
    vi.mocked(prisma.pet.findFirst).mockResolvedValue({
      id: "pet-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.note.create).mockResolvedValue({
      id: "note-1",
      petId: "pet-1",
      clientId: "owner-1",
      kind: "GENERAL",
    } as never);

    await createNote(
      { petId: "pet-1", clientId: null, kind: "GENERAL", body: "hi", pinned: false },
      ctx,
    );

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        petId: "pet-1",
        clientId: "owner-1",
        authorId: "user-1",
      }),
    });
  });
});

describe("deleteNote", () => {
  it("rejects when the note isn't in the clinic", async () => {
    vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
    await expect(deleteNote("note-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.note.delete).not.toHaveBeenCalled();
  });

  it("deletes and audits", async () => {
    vi.mocked(prisma.note.findFirst).mockResolvedValue({
      id: "note-1",
      petId: "pet-1",
      clientId: "owner-1",
    } as never);
    vi.mocked(prisma.note.delete).mockResolvedValue({} as never);

    await deleteNote("note-1", ctx);

    expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: "note-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE", entityType: "Note" }),
    });
  });
});

describe("togglePinned", () => {
  it("flips the boolean", async () => {
    vi.mocked(prisma.note.findFirst).mockResolvedValue({
      id: "note-1",
      pinned: false,
    } as never);
    vi.mocked(prisma.note.update).mockResolvedValue({} as never);

    await togglePinned("note-1", ctx);

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { pinned: true },
    });
  });

  it("rejects when the note isn't in the clinic", async () => {
    vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
    await expect(togglePinned("note-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.note.update).not.toHaveBeenCalled();
  });
});
