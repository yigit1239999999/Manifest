import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { setClinicCurrency } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "u-1",
  userName: "Admin",
  userRole: "ADMIN",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.clinic.findUnique).mockResolvedValue({ currency: "USD" } as never);
});

describe("setClinicCurrency", () => {
  it("is settings-manage only", async () => {
    await expect(
      setClinicCurrency({ currency: "TRY" }, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.clinic.update).not.toHaveBeenCalled();
  });

  // What an old invoice was priced in used to be answerable only by knowing
  // when this setting was last touched. It is written down now.
  it("records who changed it, and from what to what", async () => {
    await setClinicCurrency({ currency: "TRY" }, ctx);

    expect(prisma.clinic.update).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: { currency: "TRY" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Clinic",
        changes: { currency: { from: "USD", to: "TRY" } },
      }),
    });
  });

  it("does nothing, and audits nothing, when the value is unchanged", async () => {
    await setClinicCurrency({ currency: "USD" }, ctx);

    expect(prisma.clinic.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
