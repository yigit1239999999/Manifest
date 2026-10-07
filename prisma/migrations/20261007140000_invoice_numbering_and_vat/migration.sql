-- Sequential invoice numbers, VAT as a rate, and what an invoice line bills.
--
-- Additive only and idempotent. Existing invoices keep their numbers and
-- their typed tax amounts: "taxRate" stays null on them, and nothing here
-- renumbers or rewrites a row.

-- One counter per clinic per year. Advanced by
-- INSERT ... ON CONFLICT ("clinicId", "year") DO UPDATE SET "last" = "last" + 1
-- inside the invoice's own transaction.
CREATE TABLE IF NOT EXISTS "invoice_counters" (
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("clinicId", "year")
);

DO $$ BEGIN
    ALTER TABLE "invoice_counters"
        ADD CONSTRAINT "invoice_counters_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "taxRate" INTEGER;

DO $$ BEGIN
    CREATE TYPE "InvoiceLineKind" AS ENUM ('VISIT', 'VACCINATION', 'TREATMENT', 'DIAGNOSTIC', 'PRESCRIPTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "kind" "InvoiceLineKind";

-- The list's date range, the month-end export and "the rate this clinic
-- last used" all read invoices by issue date within a clinic.
CREATE INDEX IF NOT EXISTS "invoices_clinicId_issuedAt_idx" ON "invoices"("clinicId", "issuedAt");
