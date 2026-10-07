import { describe, expect, it } from "vitest";
import { invoiceLineText } from "./line-text";

const words = {
  kind: (k: string) => ({ VACCINATION: "Vaccination", TREATMENT: "Treatment" })[k] ?? k,
  visitType: (t: string) => ({ VACCINATION: "Vaccination visit" })[t] ?? t,
  date: (d: Date) => d.toISOString().slice(0, 10),
};

describe("an invoice line, in the reader's language (C8)", () => {
  it("names the kind of an item from the visit in the reader's words, and keeps the vet's name for it", () => {
    expect(invoiceLineText({ description: "Kuduz", kind: "VACCINATION" }, words)).toBe("Vaccination · Kuduz");
  });

  it("draws an unedited visit line from the visit itself", () => {
    expect(
      invoiceLineText(
        {
          description: "Aşı · 14 Eyl 2026",
          kind: "VISIT",
          visit: { type: "VACCINATION", visitedAt: new Date("2026-09-14T09:00:00Z") },
        },
        words,
      ),
    ).toBe("Vaccination visit · 2026-09-14");
  });

  it("prints a hand-typed line exactly as typed", () => {
    expect(invoiceLineText({ description: "Mama 2 kg", kind: null }, words)).toBe("Mama 2 kg");
  });
});
