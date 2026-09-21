import { describe, expect, it } from "vitest";
import { invoiceSchema, paymentSchema } from "./schema";

// These fields are named after the column they end up in (cents), but what
// the form sends is what a person typed. The conversion belongs to the money
// helper alone; a payment of 500 lira was once stored as 5,00 because the
// schema read the text as cents.
describe("payment amount", () => {
  const base = { invoiceId: "inv-1", method: "CASH", reference: "", notes: "" };

  it("reads a whole amount as units", () => {
    const r = paymentSchema.safeParse({ ...base, amountCents: "500" });
    expect(r.success && r.data.amountCents).toBe(50_000);
  });

  it("reads a localised amount", () => {
    const r = paymentSchema.safeParse({ ...base, amountCents: "1.234,56" });
    expect(r.success && r.data.amountCents).toBe(123_456);
  });

  it("rejects a blank or zero payment", () => {
    expect(paymentSchema.safeParse({ ...base, amountCents: "" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, amountCents: "0" }).success).toBe(false);
  });
});

describe("invoice line and tax", () => {
  const base = {
    clientId: "client-1",
    number: "INV-001",
    status: "DRAFT",
    dueAt: "",
    notes: "",
  };
  const line = {
    description: "Muayene",
    quantity: "2",
    unitPriceCents: "250",
    petId: "",
    visitId: "",
  };

  it("reads unit price and tax as units", () => {
    const r = invoiceSchema.safeParse({ ...base, taxCents: "45,50", lines: [line] });
    expect(r.success && r.data.lines[0].unitPriceCents).toBe(25_000);
    expect(r.success && r.data.taxCents).toBe(4550);
  });

  it("leaves a blank tax empty instead of zero-filling it", () => {
    const r = invoiceSchema.safeParse({ ...base, taxCents: "", lines: [line] });
    expect(r.success && r.data.taxCents).toBeNull();
  });

  it("rejects an unreadable unit price", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      taxCents: "",
      lines: [{ ...line, unitPriceCents: "abc" }],
    });
    expect(r.success).toBe(false);
  });
});
