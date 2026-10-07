-- Who saw a result, and when.
--
-- "The result arrived" and "the vet read it" were one fact in this
-- schema, and they are two: one is the result reaching the clinic, the
-- other is it reaching the person who decides what to do about it. A
-- histopathology report sat in a paper file for three days with every
-- person doing their job correctly, because nothing asked whether the
-- vet had seen it.
--
-- Nullable with no back-fill, and that is the honest default: nobody
-- has marked anything, and pretending otherwise would start the
-- feature with a lie about every existing row. The count only looks at
-- results entered before today, so the history does not arrive as a
-- pile of work on the first morning either -- it arrives as one.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "diagnostics"
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnostics_readById_fkey'
  ) THEN
    ALTER TABLE "diagnostics"
      ADD CONSTRAINT "diagnostics_readById_fkey"
      FOREIGN KEY ("readById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- The unread count reads a clinic's unmarked results oldest first.
-- Without this it is a scan of every diagnostic the clinic has ever
-- recorded, on every dashboard load.
CREATE INDEX IF NOT EXISTS "diagnostics_clinicId_readAt_createdAt_idx"
  ON "diagnostics" ("clinicId", "readAt", "createdAt");
