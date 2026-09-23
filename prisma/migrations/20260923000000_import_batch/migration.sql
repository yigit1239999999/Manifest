-- One run of the spreadsheet import, and the two columns that let it be
-- taken back.
--
-- Why a table and not just a column. The import's real risk is not the
-- writing, it is the minute after: two hundred rows arrive in a clinic
-- that had none, and the vet has to decide whether to trust them while
-- looking at a list that no longer tells them apart from their own work.
-- "Undo the whole thing" is what makes running it a small decision, and
-- undoing needs a name ("musteriler-2024.xlsx"), a count, and a place to
-- record that it was undone. A batch id scattered across two tables with
-- nothing to point at would give the vet no list to choose from.
--
-- `undoneAt` rather than deleting the batch row. What the clinic imported
-- and then took back is a fact about their day; the audit log points at
-- this id and must keep finding something at the end of that pointer.
--
-- The counts are stored rather than derived. Derived, the batch list
-- would be a count per batch (N+1 by construction, and growing with the
-- table), and every number would collapse to zero the moment a batch is
-- undone -- which is exactly when the vet wants to read "200 rows were
-- taken back".
--
-- ON DELETE SET NULL on both foreign keys, not CASCADE, and the
-- direction matters: deleting a batch row must never take a clinic's
-- records with it. Undo deletes rows deliberately, by id, inside a
-- transaction -- it is not something a foreign key should be able to do
-- as a side effect.
--
-- Idempotent throughout: IF NOT EXISTS on the table, the columns and the
-- indexes, and each constraint guarded by a catalog lookup.

CREATE TABLE IF NOT EXISTS "import_batches" (
  "id"          TEXT NOT NULL,
  "clinicId"    TEXT NOT NULL,
  "createdById" TEXT,
  "fileName"    TEXT NOT NULL,
  "sheetName"   TEXT NOT NULL,
  "clientCount" INTEGER NOT NULL DEFAULT 0,
  "petCount"    INTEGER NOT NULL DEFAULT 0,
  "mergedCount" INTEGER NOT NULL DEFAULT 0,
  "undoneAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_clinicId_fkey') THEN
    ALTER TABLE "import_batches"
      ADD CONSTRAINT "import_batches_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_createdById_fkey') THEN
    ALTER TABLE "import_batches"
      ADD CONSTRAINT "import_batches_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The batch list is "this clinic's runs, newest first", which is this
-- index read straight off.
CREATE INDEX IF NOT EXISTS "import_batches_clinicId_createdAt_idx"
  ON "import_batches" ("clinicId", "createdAt" DESC);

-- Nullable on both tables, and null is the normal case: everything the
-- clinic typed itself carries no batch. Null also means "undo may not
-- touch this row", which is what keeps a merge onto an existing client
-- from being deletable by the run that merged onto it.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;
ALTER TABLE "pets"    ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_importBatchId_fkey') THEN
    ALTER TABLE "clients"
      ADD CONSTRAINT "clients_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_importBatchId_fkey') THEN
    ALTER TABLE "pets"
      ADD CONSTRAINT "pets_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Undo reads "every row of this batch, in this clinic". `clinicId` leads
-- because every query in this product is clinic-scoped and an index that
-- is not gets slower as the table grows rather than faster.
CREATE INDEX IF NOT EXISTS "clients_clinicId_importBatchId_idx"
  ON "clients" ("clinicId", "importBatchId");
CREATE INDEX IF NOT EXISTS "pets_clinicId_importBatchId_idx"
  ON "pets" ("clinicId", "importBatchId");
