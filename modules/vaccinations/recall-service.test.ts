import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vaccination: { findFirst: vi.fn() },
    recallContact: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { deleteRecallContact, recordRecallContact } from "./recall-service";

const reception = { clinicId: "clinic-1", userId: "u-1", userName: "R", userRole: "RECEPTIONIST" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.recallContact.create).mockResolvedValue({ id: "rc-1" } as never);
});

describe("recordRecallContact", () => {
  // The person holding the phone is usually reception, who cannot write
  // vaccinations. The mark is about the call, not the vaccine.
  it("is open to reception and records who and what", async () => {
    vi.mocked(prisma.vaccination.findFirst).mockResolvedValue({ id: "v-1", petId: "p-1" } as never);
    await recordRecallContact("v-1", "UNREACHABLE", reception);
    expect(prisma.recallContact.create).toHaveBeenCalledWith({
      data: { clinicId: "clinic-1", vaccinationId: "v-1", outcome: "UNREACHABLE", byId: "u-1" },
      select: { id: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("does not reach another clinic's vaccination", async () => {
    vi.mocked(prisma.vaccination.findFirst).mockResolvedValue(null);
    await expect(recordRecallContact("v-9", "CALLED", reception)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(vi.mocked(prisma.vaccination.findFirst).mock.calls[0][0]?.where).toEqual({
      id: "v-9",
      clinicId: "clinic-1",
    });
    expect(prisma.recallContact.create).not.toHaveBeenCalled();
  });

  it("refuses an outcome that is not one of the two", async () => {
    await expect(
      recordRecallContact("v-1", "BOOKED" as never, reception),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("deleteRecallContact", () => {
  it("only takes back the caller's own mark in their own clinic", async () => {
    vi.mocked(prisma.recallContact.findFirst).mockResolvedValue(null);
    await expect(deleteRecallContact("rc-2", reception)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(vi.mocked(prisma.recallContact.findFirst).mock.calls[0][0]?.where).toEqual({
      id: "rc-2",
      clinicId: "clinic-1",
      byId: "u-1",
    });
    expect(prisma.recallContact.delete).not.toHaveBeenCalled();
  });
});
