-- A line the clinic writes when marking an animal as deceased.
--
-- Additive only. "Vefat etti olarak işaretle" now exists on the animal's
-- page with a date and an optional note; the note is kept beside
-- "deceasedAt" so the animal's page can say it back. Unmarking (marked by
-- mistake) clears both, and the audit log keeps what they were.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "deceasedNote" TEXT;
