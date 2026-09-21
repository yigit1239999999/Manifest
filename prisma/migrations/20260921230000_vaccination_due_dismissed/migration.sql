-- Closing an overdue vaccination row on the dashboard.
--
-- The stamp belongs to the vaccination, not to the animal. Archiving the
-- animal would hide it from every screen in the clinic; this hides one
-- line from one card, which is the size of the statement "I have dealt
-- with this one".
--
-- Whoever adds a way to edit a vaccination must clear this when
-- `nextDueAt` moves: a new date means the animal is being tracked again
-- and the stamp means it is not, and a row holding both appears on
-- neither card. Today the only paths are create and delete, so a new
-- date arrives as a new row and the rule holds without code.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "vaccinations"
  ADD COLUMN IF NOT EXISTS "dueDismissedAt" TIMESTAMP(3);

-- No index. The overdue card already filters on (clinicId, nextDueAt),
-- which is indexed, and the stamp only narrows what that returns: at one
-- dismissed row per overdue vaccination it cannot be the selective part
-- of the query. Noted rather than left silent, so the next person does
-- not have to re-derive that it was considered.
