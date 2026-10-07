import { describe, expect, it } from "vitest";
import { auditHref, describeAudit } from "./describe";

describe("an audit row as a sentence (B10)", () => {
  it("tells money taken from money given back", () => {
    expect(
      describeAudit({
        action: "UPDATE",
        entityType: "Invoice",
        changes: { paymentId: "p1", paymentAmount: 50_000, paidSoFar: 50_000, newStatus: "PARTIAL" },
        metadata: null,
      }),
    ).toMatchObject({ key: "paymentRecorded", amountCents: 50_000 });
    expect(
      describeAudit({
        action: "UPDATE",
        entityType: "Invoice",
        changes: { voidedPaymentId: "p1", paymentAmount: 50_000 },
        metadata: null,
      }),
    ).toMatchObject({ key: "paymentVoided", amountCents: 50_000 });
  });

  it("names issuing, voiding and creating an invoice", () => {
    expect(describeAudit({ action: "UPDATE", entityType: "Invoice", changes: { status: "SENT" }, metadata: null }).key).toBe(
      "invoiceIssued",
    );
    expect(describeAudit({ action: "UPDATE", entityType: "Invoice", changes: { status: "VOID" }, metadata: null }).key).toBe(
      "invoiceVoided",
    );
    expect(
      describeAudit({ action: "CREATE", entityType: "Invoice", changes: { number: "2026-0004", total: 1200 }, metadata: null }),
    ).toMatchObject({ key: "invoiceCreated", amountCents: 1200, values: { number: "2026-0004" } });
  });

  it("reads an import and its undo with their counts, old rows and new", () => {
    expect(
      describeAudit({
        action: "CREATE",
        entityType: "ImportBatch",
        changes: null,
        metadata: { fileName: "liste.xlsx", clients: 3, pets: 5, vaccinations: 7 },
      }),
    ).toMatchObject({ key: "importCreated", values: { clients: 3, pets: 5, vaccinations: 7, file: "liste.xlsx" } });
    expect(
      describeAudit({
        action: "DELETE",
        entityType: "ImportBatch",
        changes: null,
        metadata: { clientCount: 2, petCount: 4, vaccinationCount: 1, undo: true },
      }),
    ).toMatchObject({ key: "importUndone", values: { clients: 2, pets: 4, vaccinations: 1 } });
  });

  it("falls back to the record and the verb, and links only what has a page", () => {
    expect(describeAudit({ action: "ARCHIVE", entityType: "Pet", changes: null, metadata: null }).key).toBe("generic");
    expect(auditHref("Pet", "p1")).toBe("/pets/p1");
    expect(auditHref("Vaccination", "v1")).toBeNull();
  });
});
