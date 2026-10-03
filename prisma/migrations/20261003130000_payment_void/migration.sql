-- Voiding a payment that was recorded by mistake.
--
-- Additive only. A voided payment keeps its row: it is the record that an
-- amount was once entered against the invoice and then taken back, by whom
-- and why. Deleting it would make the audit trail point at nothing. Every
-- sum of what an invoice has been paid filters on "voidedAt" IS NULL.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedById" TEXT,
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_voidedById_fkey'
  ) THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_voidedById_fkey"
      FOREIGN KEY ("voidedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The foreign key gets its index for the reason invoice_lines' did: Postgres
-- does not index a foreign key, and removing a user would otherwise scan
-- every payment to null this column. No index on "voidedAt": it only
-- narrows the payments of one invoice, which "invoiceId" already finds.
CREATE INDEX IF NOT EXISTS "payments_voidedById_idx" ON "payments" ("voidedById");
