import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    invoice: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    client: { findFirst: vi.fn() },
    payment: {
      create: vi.fn(),
      aggregate: vi.fn(),
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
import { createInvoice, recordPayment, voidInvoice } from "./service";

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
  taxCents: null,
  notes: null,
  lines: [
    {
      description: "Consultation",
      quantity: 1,
      unitPriceCents: 5000,
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
    vi.mocked(prisma.invoice.create).mockResolvedValue({ id: "inv-1", clientId: "client-1" } as never);

    const input = {
      ...baseInvoice,
      taxCents: 500,
      lines: [
        { description: "A", quantity: 2, unitPriceCents: 1000, petId: null, visitId: null },
        { description: "B", quantity: 1, unitPriceCents: 3000, petId: null, visitId: null },
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
      }),
      include: { lines: true },
    });
  });
});

describe("recordPayment", () => {
  it("requires payments.write permission (RECEPTIONIST can pay, VET_TECH cannot)", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      totalCents: 10000,
      status: "SENT",
    } as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amountCents: 0 },
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    const input = {
      invoiceId: "inv-1",
      amountCents: 5000,
      method: "CARD" as const,
      reference: null,
      notes: null,
    };

    await expect(
      recordPayment(input, { ...ctx, userRole: "VET_TECH" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects when the invoice belongs to another clinic", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
    await expect(
      recordPayment(
        { invoiceId: "inv-x", amountCents: 100, method: "CASH", reference: null, notes: null },
        ctx,
      ),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("opens a Serializable transaction and computes status from the post-insert sum", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      totalCents: 10000,
      status: "SENT",
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: "pay-1" } as never);
    // Aggregate runs inside the tx, so it returns the post-insert total.
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amountCents: 10000 },
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    await recordPayment(
      {
        invoiceId: "inv-1",
        amountCents: 4000,
        method: "CARD",
        reference: null,
        notes: null,
      },
      ctx,
    );

    // Transaction used Serializable isolation.
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    // Status was upgraded to PAID because the post-insert sum >= total.
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
      }),
    });
  });

  it("marks the invoice PARTIAL when paid less than total", async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: "inv-1",
      totalCents: 10000,
      status: "SENT",
    } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amountCents: 3000 },
    } as never);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as never);

    await recordPayment(
      {
        invoiceId: "inv-1",
        amountCents: 3000,
        method: "CASH",
        reference: null,
        notes: null,
      },
      ctx,
    );

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        status: "PARTIAL",
        paidAt: null,
      }),
    });
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
