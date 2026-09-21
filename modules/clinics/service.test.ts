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
import { setClinicCurrency, setFirstStepHidden } from "./service";

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

// The card exists to be read on a first morning and to disappear by
// itself once the chain is complete. The clinic that needs this one is
// the clinic being asked for something it has decided not to do -- and
// a prompt with no way out gets ignored, which spends the attention the
// card was collecting.
describe("setFirstStepHidden", () => {
  beforeEach(() => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      firstStepHiddenAt: null,
    } as never);
  });

  it("writes when it was closed, not merely that it was", async () => {
    const before = Date.now();
    const result = await setFirstStepHidden(true, ctx);

    const written = vi.mocked(prisma.clinic.update).mock.calls[0][0] as {
      where: { id: string };
      data: { firstStepHiddenAt: Date | null };
    };
    expect(written.where.id).toBe("clinic-1");
    expect(written.data.firstStepHiddenAt).toBeInstanceOf(Date);
    expect(
      (written.data.firstStepHiddenAt as Date).getTime(),
    ).toBeGreaterThanOrEqual(before);
    expect(result.firstStepHiddenAt).toBeInstanceOf(Date);
  });

  // Undo is a write of null, so "nobody ever closed it" and "somebody
  // put it back" are the same state -- which is what makes the card
  // returnable rather than spent.
  it("puts the card back by clearing the stamp", async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      firstStepHiddenAt: new Date("2026-09-20T08:00:00Z"),
    } as never);

    await setFirstStepHidden(false, ctx);

    expect(prisma.clinic.update).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: { firstStepHiddenAt: null },
    });
  });

  it("says nothing when the card is already in that state", async () => {
    await setFirstStepHidden(false, ctx);

    expect(prisma.clinic.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  // Clinic-wide, so it is behind the floor of the chain the card names.
  // A technician has neither `clients.write` nor `pets.write`, sees the
  // waiting sentence rather than a button, and would otherwise be
  // deciding for everybody about a prompt they cannot act on.
  it("is closed to a reader who cannot do what it asks", async () => {
    await expect(
      setFirstStepHidden(true, { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.clinic.update).not.toHaveBeenCalled();
  });

  it("records who closed it", async () => {
    await setFirstStepHidden(true, ctx);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        actorId: "u-1",
        entityType: "Clinic",
        entityId: "clinic-1",
        changes: { firstStepHidden: true },
      }),
    });
  });
});
