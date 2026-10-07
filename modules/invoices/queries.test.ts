import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoiceLine: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    payment: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { clientBalance, getInvoiceById, getInvoiceForVisit, listInvoicesPage } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.invoiceLine.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
  vi.mocked(prisma.invoice.count).mockResolvedValue(0);
  vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);
});

// "Who has not paid, and how much is left?" A partly paid invoice owes
// its remainder, not its total, and a voided payment is money taken back.
describe("what the invoice list says is still owed", () => {
  const row = (id: string, status: string, totalCents: number) =>
    ({ id, status, totalCents, currency: "TRY" }) as never;

  it("is the total less the payments that were not voided", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      row("inv-1", "PARTIAL", 100_000),
      row("inv-2", "SENT", 45_000),
    ]);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { invoiceId: "inv-1", _sum: { amountCents: 30_000 } },
    ] as never);

    const { items } = await listInvoicesPage({ clinicId: "clinic-1" });

    expect(items.map((i) => i.remainingCents)).toEqual([70_000, 45_000]);
    // The voided ones are left out where they are summed, in the database.
    const args = vi.mocked(prisma.payment.groupBy).mock.calls[0][0];
    expect(args.where).toEqual({
      invoiceId: { in: ["inv-1", "inv-2"] },
      voidedAt: null,
    });
  });

  it("asks once for the whole page, not once per row", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      row("inv-1", "SENT", 1),
      row("inv-2", "SENT", 1),
      row("inv-3", "SENT", 1),
    ]);
    await listInvoicesPage({ clinicId: "clinic-1" });
    expect(prisma.payment.groupBy).toHaveBeenCalledTimes(1);
  });

  it("does not ask at all for an empty page", async () => {
    await listInvoicesPage({ clinicId: "clinic-1" });
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });

  it("never goes below zero, and says nothing for a voided invoice", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      row("inv-1", "PAID", 10_000),
      row("inv-2", "VOID", 10_000),
    ]);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { invoiceId: "inv-1", _sum: { amountCents: 12_000 } },
    ] as never);

    const { items } = await listInvoicesPage({ clinicId: "clinic-1" });

    expect(items.map((i) => i.remainingCents)).toEqual([0, null]);
  });

  it("says nothing is owed on a draft, and nothing on an invoice marked paid without a payment", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      row("inv-1", "DRAFT", 20_000),
      row("inv-2", "PAID", 15_000),
    ]);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);

    const { items } = await listInvoicesPage({ clinicId: "clinic-1" });

    expect(items.map((i) => i.remainingCents)).toEqual([null, 0]);
  });

  it("filters on both unpaid statuses when asked for them", async () => {
    await listInvoicesPage({ clinicId: "clinic-1", statuses: ["SENT", "PARTIAL"] });
    const where = vi.mocked(prisma.invoice.findMany).mock.calls[0][0]?.where;
    expect(where).toMatchObject({
      clinicId: "clinic-1",
      status: { in: ["SENT", "PARTIAL"] },
    });
  });
});

// A visit billed twice is two demands for the same money, and the
// clinic finds out when the client does. The visit page either offers
// to bill or points at the bill, and this query is what decides which
// — so what it asks matters more than what it returns.
describe("the invoice a visit already has", () => {
  it("is found through the line, because that is where a visit is named", async () => {
    // An invoice can gather several visits and names none of them; only
    // the line carries `visitId`. Looking on the invoice would find
    // nothing and quietly answer "not billed yet".
    await getInvoiceForVisit("clinic-1", "v-1");

    const args = vi.mocked(prisma.invoiceLine.findFirst).mock.calls[0][0];
    expect(args?.where).toEqual({ visitId: "v-1", invoice: { clinicId: "clinic-1" } });
  });

  it("scopes by clinic through the invoice, since a line has no clinic", async () => {
    // Asserted separately from the shape above because this is the
    // tenancy boundary: without it, a visit id from another clinic
    // would report that clinic's invoice back.
    await getInvoiceForVisit("clinic-1", "v-1");

    const where = vi.mocked(prisma.invoiceLine.findFirst).mock.calls[0][0]?.where;
    expect(where).toHaveProperty("invoice.clinicId", "clinic-1");
  });

  it("answers with the invoice itself, not the line", async () => {
    vi.mocked(prisma.invoiceLine.findFirst).mockResolvedValue({
      invoice: {
        id: "inv-1",
        number: "INV-2026-00042",
        status: "SENT",
        totalCents: 45000,
        currency: "TRY",
      },
    } as never);

    // `currency` travels with `totalCents` deliberately: a total
    // without the unit it was recorded in is a number with no meaning,
    // and re-reading it in the clinic's current setting is how a
    // clinic that changed currency silently re-prices its own past.
    expect(await getInvoiceForVisit("clinic-1", "v-1")).toEqual({
      id: "inv-1",
      number: "INV-2026-00042",
      status: "SENT",
      totalCents: 45000,
      currency: "TRY",
    });
  });

  it("says no when nothing bills this visit", async () => {
    // Null and not undefined, and not a thrown "not found": "this visit
    // has no invoice" is an ordinary answer, and the page turns it into
    // an offer to make one.
    expect(await getInvoiceForVisit("clinic-1", "v-1")).toBeNull();
  });
});

// ux asked for the link in both directions: a visit says which invoice
// it went to, and an invoice says which visit it came from. The second
// half is a read — without it `visitId` is a column that gets filled
// and never shown, which on screen is the same as not having it.
describe("what an invoice says about where its lines came from", () => {
  it("loads each line's visit, not just its animal", async () => {
    await getInvoiceById("clinic-1", "inv-1");

    const args = vi.mocked(prisma.invoice.findFirst).mock.calls[0][0];
    const lines = (args?.include as Record<string, { include?: object }>).lines;

    // On the line and not on the invoice: an invoice can gather
    // several visits, and a single link in the header would have to
    // pick one of them and be wrong about the rest.
    expect(lines.include).toHaveProperty("visit");
    expect(args?.include).not.toHaveProperty("visit");
  });
});

describe("what one owner still owes (the client page's 'Toplam borç')", () => {
  it("sums the open invoices less their unvoided payments, and counts only those still owing", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { id: "a", totalCents: 50_000, currency: "TRY" },
      { id: "b", totalCents: 20_000, currency: "TRY" },
      { id: "c", totalCents: 10_000, currency: "TRY" },
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { invoiceId: "a", _sum: { amountCents: 35_000 } },
      // Paid off by payments while still marked SENT: owes nothing.
      { invoiceId: "c", _sum: { amountCents: 10_000 } },
    ] as never);

    const balance = await clientBalance("clinic-1", "client-1");

    expect(balance).toEqual({ owed: [{ currency: "TRY", cents: 35_000 }], invoiceCount: 2 });
    expect(vi.mocked(prisma.invoice.findMany).mock.calls[0][0]).toMatchObject({
      where: { clinicId: "clinic-1", clientId: "client-1", status: { in: ["SENT", "PARTIAL"] } },
    });
    expect(vi.mocked(prisma.payment.groupBy).mock.calls[0][0]).toMatchObject({
      where: { voidedAt: null },
    });
  });

  it("asks nothing more when the owner has no open invoice", async () => {
    expect(await clientBalance("clinic-1", "client-1")).toEqual({ owed: [], invoiceCount: 0 });
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });
});
