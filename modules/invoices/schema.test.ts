import { describe, expect, it } from "vitest";
import { invoiceSchema, paymentSchema } from "./schema";

// The form sends what a person typed, in the locale they typed it in; the
// schema is the only place that becomes cents. A payment of 500 lira was
// once stored as 5,00 because the field's name said cents and the schema
// believed it.
describe("payment amount", () => {
  const base = { invoiceId: "inv-1", method: "CASH", reference: "", notes: "" };
  const parse = (amount: string, locale = "tr") =>
    paymentSchema(locale).safeParse({ ...base, amount });

  it("reads a whole amount as units", () => {
    const r = parse("500");
    expect(r.success && r.data.amount).toBe(50_000);
  });

  it("reads a localised amount", () => {
    expect(parse("1.234,56").success && parse("1.234,56").data?.amount).toBe(123_456);
    expect(parse("1,234.56", "en").success && parse("1,234.56", "en").data?.amount).toBe(
      123_456,
    );
  });

  // pm found this one in the browser: a 250 lira invoice was paid off with
  // "10,999", which in Turkish is ten lira and 99,9 kuruş.
  it("refuses sub-cent precision instead of reading it as thousands", () => {
    expect(parse("10,999").success).toBe(false);
    expect(parse("10.999", "en").success).toBe(false);
  });

  it("rejects a blank or zero payment", () => {
    expect(parse("").success).toBe(false);
    expect(parse("0").success).toBe(false);
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
    unitPrice: "250",
    petId: "",
    visitId: "",
  };

  it("reads unit price and tax as units", () => {
    const r = invoiceSchema("tr").safeParse({ ...base, tax: "45,50", lines: [line] });
    expect(r.success && r.data.lines[0].unitPrice).toBe(25_000);
    expect(r.success && r.data.tax).toBe(4550);
  });

  it("leaves a blank tax empty instead of zero-filling it", () => {
    const r = invoiceSchema("tr").safeParse({ ...base, tax: "", lines: [line] });
    expect(r.success && r.data.tax).toBeNull();
  });

  it("rejects an unreadable unit price", () => {
    const r = invoiceSchema("tr").safeParse({
      ...base,
      tax: "",
      lines: [{ ...line, unitPrice: "abc" }],
    });
    expect(r.success).toBe(false);
  });
});
