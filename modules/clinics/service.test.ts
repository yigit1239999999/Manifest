import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn(), update: vi.fn() },
    // Present only so the test below can prove nothing touches it.
    invoice: { update: vi.fn(), updateMany: vi.fn() },
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

  // The claim the whole of backlog 32 rests on, and the one nobody could
  // check on screen for two releases because the settings dialog was not
  // saving at all: changing the clinic's currency restates nothing. Every
  // invoice carries the currency it was issued in, stamped at creation
  // (`modules/invoices/service.ts`), so a clinic switching from dollars to
  // lira does not silently re-price a year of billing.
  it("does not touch a single invoice", async () => {
    await setClinicCurrency({ currency: "TRY" }, ctx);

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});
