import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { invoiceLine: { findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getInvoiceForVisit } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.invoiceLine.findFirst).mockResolvedValue(null);
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
