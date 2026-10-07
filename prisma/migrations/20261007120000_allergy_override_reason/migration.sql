-- The reason a vet gave for writing a drug that matches the animal's
-- recorded allergy.
--
-- Additive only. The server now refuses a prescription or treatment whose
-- drug matches the animal's medical alerts unless a reason comes with it;
-- the reason is kept on the row it excuses (and in the audit log), so the
-- record says why, not only that. Existing rows were never checked and
-- stay null.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "prescriptions"
  ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;

ALTER TABLE "treatments"
  ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;
