-- When the pet form's weight was entered.
--
-- Additive only. The animal's weight is now the newer of two readings,
-- the pet form's and the latest weighed visit's; comparing them needs the
-- form's to have a date. Existing weights stay undated, which reads as
-- "older than any visit": nobody can say when they were true.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "weightRecordedAt" TIMESTAMP(3);
