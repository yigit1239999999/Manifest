import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    invoice: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    client: { findFirst: vi.fn() },
    clinic: { findUnique: vi.fn() },
    payment: {
      create: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (
      arg: ((tx: typeof prismaMock) => Promise<unknown>) | unknown,
    ) => (typeof arg === "function" ? arg(prismaMock) : arg),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { msg } from "@/lib/forms";
import { createInvoice, recordPayment, voidInvoice, voidPayment } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const baseInvoice = {
  clientId: "client-1",
  number: "INV-001",
  status: "DRAFT" as const,
  dueAt: null,
  tax: null,
  notes: null,
  lines: [
    {
      description: "Consultation",
      quantity: 1,
      unitPrice: 5000,
      petId: null,
      visitId: null,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (
      arg: ((tx: typeof prisma) => Promise<unknown>) | unknown,
    ) => (typeof arg === "function" ? arg(prisma) : arg),
  );
});

describe("createInvoice", () => {
  it("rejects when the client isn't in the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
    await expect(createInvoice(baseInvoice, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate invoice number", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "client-1" } as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: "inv-existing" } as never);
    await expect(createInvoice(baseInvoice, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("computes subtotal/total and persists clinicId", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "client-1" } as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({ currency: "TRY" } as never);
    vi.mocked(prisma.invoice.create).mockResolvedValue({ id: "inv-1", clientId: "client-1" } as never);

    const input = {
      ...baseInvoice,
      tax: 500,
      lines: [
        { description: "A", quantity: 2, unitPrice: 1000, petId: null, visitId: null },
        { description: "B", quantity: 1, unitPrice: 3000, petId: null, visitId: null },
      ],
    };

    await createInvoice(input, ctx);

    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        clientId: "client-1",
        subtotalCents: 5000,
        taxCents: 500,
        totalCents: 5500,
        // Stamped from the clinic at issue time, so changing the setting
        // later cannot restate this invoice.
        currency: "TRY",
      }),
      include: { lines: true },
    });
  });
});

describe("recordPayment", () => {
  const payment = (amount: number) => ({
    invoiceId: "inv-1",
    amount,
    method: "CARD" as const,
    reference: null,
    notes: null,
  });

  // One mock serves both reads: the tenant check outside the transaction
  // and the balance read inside it.
  function invoiceWith({
    totalCents = 10000,
    currency = "TRY",
    status = "SENT",
    paidCents = 0,
  }: {
    totalCents?: number;
    currency?: string;
    status?: string;
    paidCents?: number;
  } = {}) {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      totalCents,
      currency,
      status,
    } as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amountCents: paidCents },
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);
  }

  /** The field error a refused payment carries, as the form receives it. */
  async function amountErrorOf(promise: Promise<unknown>) {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.code).toBe("VALIDATION_FAILED");
    return (appError.details?.fieldErrors as Record<string, string[]>).amount;
  }

  it("requires payments.write permission (RECEPTIONIST can pay, VET_TECH cannot)", async () => {
    invoiceWith();
    await expect(
      recordPayment(payment(5000), { ...ctx, userRole: "VET_TECH" }, "tr"),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects when the invoice belongs to another clinic", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
    await expect(
      recordPayment({ ...payment(100), invoiceId: "inv-x" }, ctx, "tr"),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("opens a Serializable transaction and marks the invoice PAID when the balance is met", async () => {
    invoiceWith({ totalCents: 10000, paidCents: 6000 });

    await recordPayment(payment(4000), ctx, "tr");

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        status: "PAID",
        paidAt: expect.any(Date),
      }),
    });
    // Audit was written within the same tx (mock invokes callback with prisma).
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "Invoice",
        entityId: "inv-1",
        changes: expect.objectContaining({ paidSoFar: 10000, newStatus: "PAID" }),
      }),
    });
  });

  it("marks the invoice PARTIAL when paid less than total", async () => {
    invoiceWith({ totalCents: 10000, paidCents: 0 });

    await recordPayment(payment(3000), ctx, "tr");

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({ status: "PARTIAL", paidAt: null }),
    });
  });

  it("accepts exactly the remaining balance", async () => {
    invoiceWith({ totalCents: 22222, currency: "USD", paidCents: 0 });
    await expect(recordPayment(payment(22222), ctx, "en")).resolves.toEqual({
      id: "pay-1",
    });
    expect(prisma.payment.create).toHaveBeenCalledOnce();
    // A voided payment gives its amount back to the balance.
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { invoiceId: "inv-1", voidedAt: null },
      _sum: { amountCents: true },
    });
  });

  // The defect QA measured: "1,234.56" typed on a $222.22 invoice was stored
  // and closed the invoice as PAID.
  it("refuses a payment one cent over the balance, naming what is left", async () => {
    invoiceWith({ totalCents: 22222, currency: "USD", paidCents: 0 });
    const errors = await amountErrorOf(recordPayment(payment(22223), ctx, "en"));
    expect(errors).toEqual([
      msg("error.form.paymentOverBalance", { remaining: "$222.22" }),
    ]);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("words the remaining balance in the reader's locale and the invoice's currency", async () => {
    invoiceWith({ totalCents: 22222, currency: "TRY", paidCents: 2222 });
    const errors = await amountErrorOf(recordPayment(payment(123456), ctx, "tr"));
    expect(errors).toEqual([
      msg("error.form.paymentOverBalance", { remaining: "₺200,00" }),
    ]);
  });

  it("handles a currency with no minor unit (JPY)", async () => {
    invoiceWith({ totalCents: 123_400, currency: "JPY", paidCents: 0 });
    await expect(recordPayment(payment(123_400), ctx, "en")).resolves.toBeTruthy();

    vi.mocked(prisma.payment.create).mockClear();
    const errors = await amountErrorOf(recordPayment(payment(123_500), ctx, "en"));
    expect(errors).toEqual([
      msg("error.form.paymentOverBalance", { remaining: "¥1,234" }),
    ]);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("says nothing is owed when the invoice is already settled", async () => {
    invoiceWith({ totalCents: 10000, paidCents: 10000 });
    const errors = await amountErrorOf(recordPayment(payment(1), ctx, "tr"));
    expect(errors).toEqual([msg("error.form.paymentNothingOwed")]);
  });

  it("refuses a payment on a voided invoice", async () => {
    invoiceWith({ status: "VOID" });
    await expect(recordPayment(payment(100), ctx, "tr")).rejects.toMatchObject({
      code: "CONFLICT",
      messageKey: "error.conflict.invoiceVoided",
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  // Two payments of 60 on a 100 invoice, taken at the same moment. Postgres
  // cannot serialize both and fails one with P2034; the retry then reads the
  // balance the winner left behind and refuses the loser for the right
  // reason, instead of either accepting it or showing an error page.
  it("re-runs a payment that lost a serialization race against the new balance", async () => {
    invoiceWith({ totalCents: 10000, currency: "USD", paidCents: 6000 });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async () => {
      throw Object.assign(new Error("serialization failure"), { code: "P2034" });
    });

    const errors = await amountErrorOf(recordPayment(payment(6000), ctx, "en"));

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(errors).toEqual([
      msg("error.form.paymentOverBalance", { remaining: "$40.00" }),
    ]);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("gives up after repeated serialization failures rather than looping", async () => {
    invoiceWith();
    vi.mocked(prisma.$transaction).mockImplementation(async () => {
      throw Object.assign(new Error("serialization failure"), { code: "P2034" });
    });
    await expect(recordPayment(payment(100), ctx, "tr")).rejects.toMatchObject({
      code: "P2034",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe("voidInvoice", () => {
  it("requires invoices.void permission (denied for VET / RECEPTIONIST)", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      clientId: "client-1",
    } as never);
    await expect(
      voidInvoice("inv-1", { ...ctx, userRole: "VETERINARIAN" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("sets VOID and writes audit for admins", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      clientId: "client-1",
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    await voidInvoice("inv-1", ctx);

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "VOID" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "Invoice",
        entityId: "inv-1",
      }),
    });
  });
});

describe("voidPayment", () => {
  function paymentWith({
    amountCents = 4000,
    voidedAt = null as Date | null,
    totalCents = 10000,
    status = "PAID",
    paidAt = new Date("2026-10-01T10:00:00Z") as Date | null,
    paidAfterVoid = 6000,
  } = {}) {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: "pay-1",
      invoiceId: "inv-1",
      amountCents,
      voidedAt,
      invoice: { totalCents, status, paidAt },
    } as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amountCents: paidAfterVoid },
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);
  }

  it("requires payments.write (VET_TECH cannot void)", async () => {
    paymentWith();
    await expect(
      voidPayment("pay-1", { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("only finds payments on the caller's clinic's invoices", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    await expect(voidPayment("pay-x", ctx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-x", invoice: { clinicId: "clinic-1" } },
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("keeps the row, stamps who and when, and takes PAID back to PARTIAL", async () => {
    paymentWith({ paidAfterVoid: 6000 });

    await voidPayment("pay-1", ctx, "  typed 1,234.56  ");

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        voidedAt: expect.any(Date),
        voidedById: "user-1",
        voidReason: "typed 1,234.56",
      },
    });
    // The sum that decides the status leaves voided payments out.
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { invoiceId: "inv-1", voidedAt: null },
      _sum: { amountCents: true },
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "PARTIAL", paidAt: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "Invoice",
        entityId: "inv-1",
        actorId: "user-1",
        changes: expect.objectContaining({
          voidedPaymentId: "pay-1",
          paymentAmount: 4000,
          previousStatus: "PAID",
          newStatus: "PARTIAL",
        }),
      }),
    });
  });

  it("goes back to SENT when no payment is left", async () => {
    paymentWith({ amountCents: 10000, paidAfterVoid: 0 });
    await voidPayment("pay-1", ctx);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "SENT", paidAt: null },
    });
  });

  it("stays PAID, keeping its paid date, when what is left still covers the total", async () => {
    const paidAt = new Date("2026-09-30T08:00:00Z");
    paymentWith({ amountCents: 500, paidAfterVoid: 10000, paidAt });
    await voidPayment("pay-1", ctx);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "PAID", paidAt },
    });
  });

  it("leaves a voided invoice voided", async () => {
    paymentWith({ status: "VOID", paidAfterVoid: 0 });
    await voidPayment("pay-1", ctx);
    expect(prisma.payment.update).toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("is a no-op on a payment already voided", async () => {
    paymentWith({ voidedAt: new Date() });
    await expect(voidPayment("pay-1", ctx)).resolves.toEqual({ invoiceId: "inv-1" });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
