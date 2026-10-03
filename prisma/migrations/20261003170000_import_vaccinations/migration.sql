-- Vaccinations from a spreadsheet, and the two facts they carry that a
-- vaccination typed at the counter does not.
--
-- Additive only, and idempotent like the batch migration it extends.
--
-- "importBatchId" on vaccinations: the same column, the same meaning and
-- the same ON DELETE SET NULL as on clients and pets. Undo deletes by
-- batch, and without it an imported rabies date would be a record the
-- clinic "worked on" -- undo would keep the animal it hangs on, and the
-- import could never be taken back whole.
--
-- "administeredDateOnly": the file says which DAY, never what time. The
-- column holds an instant, so the day is stored at UTC noon -- the same
-- calendar day in every clinic zone from -11 to +11 -- and this flag tells
-- every screen to print the day and nothing else. Without it
-- the record page would print a time of day nobody wrote. False for every
-- existing row, which is true: those were typed with a time.
--
-- "vaccinationCount" on import_batches: stored for the reason the other
-- counts are -- the batch list stays one query, and the number still
-- reads correctly after the rows are undone.

ALTER TABLE "vaccinations"
  ADD COLUMN IF NOT EXISTS "importBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "administeredDateOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "import_batches"
  ADD COLUMN IF NOT EXISTS "vaccinationCount" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vaccinations_importBatchId_fkey') THEN
    ALTER TABLE "vaccinations"
      ADD CONSTRAINT "vaccinations_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "vaccinations_clinicId_importBatchId_idx"
  ON "vaccinations" ("clinicId", "importBatchId");
