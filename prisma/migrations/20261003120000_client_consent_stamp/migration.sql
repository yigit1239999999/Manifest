-- Backlog 14b: when, and by which path, a client's notification consent
-- was recorded. A bare boolean is a claim; proof of consent is a time and
-- a source.
--
-- Additive only. No back-fill, on purpose: writing `createdAt` (or any
-- other date) into the rows answered before this migration would invent
-- proof that nobody holds. Those rows stay NULL, which says the true
-- thing -- "we do not know when".
--
-- Idempotent: safe to run against a database that already has it.

DO $$ BEGIN
  CREATE TYPE "ConsentSource" AS ENUM ('STAFF_FORM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "notificationsOptInAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notificationsOptInSource" "ConsentSource";

-- No index. Nothing filters or sorts on these; they are read one client
-- at a time, when someone asks for the proof.
