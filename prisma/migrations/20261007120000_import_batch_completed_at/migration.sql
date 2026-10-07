-- When an import's last row was written, so undo can tell the rows the
-- run made from the rows somebody has changed since. Additive and
-- nullable: existing batches keep working and read a fallback cutoff.
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
