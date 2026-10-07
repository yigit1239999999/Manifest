/**
 * An audit row as a sentence a vet reads, not a database event.
 *
 * The page printed "Güncellendi | Invoice cmux…": an English model name, a
 * truncated id, and a verb that said the same thing for "₺500 was taken"
 * and "that ₺500 was given back" (QA B10). The rows were always there; what
 * they meant was only legible to whoever wrote the service.
 *
 * Pure: an entry in, a message key and its values out. The page owns the
 * words; this owns which event an entry is, read from what each service
 * writes into `changes` and `metadata` (`modules/invoices/service.ts`,
 * `modules/import/service.ts`). An entry nobody taught it falls back to
 * "<record> <verb>", which is honest and still Turkish.
 */
export type AuditEntryLike = {
  action: string;
  entityType: string;
  changes: unknown;
  metadata: unknown;
};

export type AuditSentence = {
  key:
    | "paymentRecorded"
    | "paymentVoided"
    | "invoiceIssued"
    | "invoiceVoided"
    | "invoiceCreated"
    | "importCreated"
    | "importUndone"
    | "generic";
  /** Money in cents, to be formatted in the invoice's currency. */
  amountCents?: number;
  values: Record<string, string | number>;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

export function describeAudit(entry: AuditEntryLike): AuditSentence {
  const changes = record(entry.changes);
  const metadata = record(entry.metadata);

  if (entry.entityType === "Invoice") {
    if (typeof changes.voidedPaymentId === "string") {
      return { key: "paymentVoided", amountCents: num(changes.paymentAmount), values: {} };
    }
    if (typeof changes.paymentId === "string") {
      return { key: "paymentRecorded", amountCents: num(changes.paymentAmount), values: {} };
    }
    if (entry.action === "CREATE") {
      return {
        key: "invoiceCreated",
        amountCents: num(changes.total),
        values: { number: typeof changes.number === "string" ? changes.number : "" },
      };
    }
    if (changes.status === "SENT") return { key: "invoiceIssued", values: {} };
    if (changes.status === "VOID") return { key: "invoiceVoided", values: {} };
  }

  if (entry.entityType === "ImportBatch") {
    const counts = {
      clients: num(metadata.clients ?? metadata.clientCount) ?? 0,
      pets: num(metadata.pets ?? metadata.petCount) ?? 0,
      vaccinations: num(metadata.vaccinations ?? metadata.vaccinationCount) ?? 0,
      file: typeof metadata.fileName === "string" ? metadata.fileName : "",
    };
    if (entry.action === "CREATE") return { key: "importCreated", values: counts };
    if (entry.action === "DELETE") return { key: "importUndone", values: counts };
  }

  return { key: "generic", values: {} };
}

/** The record types the page can name, filter by and link to. */
export const AUDIT_ENTITY_TYPES = [
  "Client",
  "Pet",
  "Visit",
  "Appointment",
  "Vaccination",
  "Prescription",
  "Treatment",
  "Diagnostic",
  "Note",
  "Reminder",
  "Invoice",
  "ImportBatch",
  "User",
  "Clinic",
  "CustomSpecies",
  "MessageLog",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export function isAuditEntityType(value: string | null | undefined): value is AuditEntityType {
  return !!value && (AUDIT_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Where a record of this type lives, when it has a page of its own. */
export function auditHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Client":
      return `/clients/${entityId}`;
    case "Pet":
      return `/pets/${entityId}`;
    case "Visit":
      return `/visits/${entityId}`;
    case "Appointment":
      return `/appointments/${entityId}`;
    case "Invoice":
      return `/invoices/${entityId}`;
    case "ImportBatch":
      return "/import";
    default:
      return null;
  }
}
