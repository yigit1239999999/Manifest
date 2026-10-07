-- Who tried to reach an owner about a due vaccination, when, and what came
-- of it ("Arandı" / "Ulaşılamadı" on the recall list).
--
-- Additive only: a new enum and a new table. Nothing existing is altered.
-- Idempotent: safe to run against a database that already has it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecallOutcome') THEN
    CREATE TYPE "RecallOutcome" AS ENUM ('CALLED', 'UNREACHABLE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recall_contacts" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "vaccinationId" TEXT NOT NULL,
    "outcome" "RecallOutcome" NOT NULL,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recall_contacts_pkey" PRIMARY KEY ("id")
);

-- The list reads the newest attempt per vaccination.
CREATE INDEX IF NOT EXISTS "recall_contacts_vaccinationId_createdAt_idx"
  ON "recall_contacts" ("vaccinationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "recall_contacts_clinicId_idx" ON "recall_contacts" ("clinicId");
-- Foreign keys are not indexed by Postgres; removing a user would otherwise
-- scan the table to null this column.
CREATE INDEX IF NOT EXISTS "recall_contacts_byId_idx" ON "recall_contacts" ("byId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recall_contacts_clinicId_fkey') THEN
    ALTER TABLE "recall_contacts" ADD CONSTRAINT "recall_contacts_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recall_contacts_vaccinationId_fkey') THEN
    ALTER TABLE "recall_contacts" ADD CONSTRAINT "recall_contacts_vaccinationId_fkey"
      FOREIGN KEY ("vaccinationId") REFERENCES "vaccinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recall_contacts_byId_fkey') THEN
    ALTER TABLE "recall_contacts" ADD CONSTRAINT "recall_contacts_byId_fkey"
      FOREIGN KEY ("byId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
