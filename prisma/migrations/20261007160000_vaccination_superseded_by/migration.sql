-- A vaccination answered by a later dose of the same vaccine.
--
-- Additive only. pm found an animal re-vaccinated against Lyme still
-- listed as overdue for it: the overdue and upcoming lists read each row's
-- "nextDueAt" alone and never asked whether a newer dose had been given.
-- "supersededById" names that newer dose; the lists skip rows where it is
-- set. The application recomputes it per animal on every vaccination
-- write (matching names through the catalogue's aliases, which SQL cannot
-- see); ON DELETE SET NULL puts a row back on the lists when the dose
-- that answered it is removed.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "vaccinations"
  ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vaccinations_supersededById_fkey'
  ) THEN
    ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_supersededById_fkey"
      FOREIGN KEY ("supersededById") REFERENCES "vaccinations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The foreign key gets its index for the reason payments' did: deleting a
-- vaccination would otherwise scan the table to null this column.
CREATE INDEX IF NOT EXISTS "vaccinations_supersededById_idx"
  ON "vaccinations" ("supersededById");

-- Existing history, by the same folded name only. Each row points at the
-- next newer dose with the same name for the same animal. Names that are
-- the same vaccine only through a catalogue alias ("Karma" and "DHPPi")
-- are linked the next time that animal's vaccinations are written; this
-- statement cannot read the catalogue, and leaving them unlinked shows a
-- row that may be answered, never hides one that is not.
UPDATE "vaccinations" AS v
SET "supersededById" = n.next_id
FROM (
  SELECT
    id,
    LEAD(id) OVER (
      PARTITION BY "clinicId", "petId", lower(public.immutable_unaccent(btrim(name)))
      ORDER BY "administeredAt", id
    ) AS next_id
  FROM "vaccinations"
) AS n
WHERE v.id = n.id
  AND n.next_id IS NOT NULL
  AND v."supersededById" IS NULL;
