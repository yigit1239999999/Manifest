-- Where a result came from, because the read-marker loop is only for
-- the ones that arrive from outside.
--
-- Three quarters of a vet's tests are run in the room: the printout is
-- in their hand, they turn round and tell the owner, and the result
-- closes in that conversation. A button afterwards asks them to finish
-- a finished job several times a day; they stop pressing within a
-- week, unpressed rows accumulate, and they stop reading the list --
-- which is the failure the list exists to prevent. The results that
-- actually go missing share one property: nobody was in the room when
-- they arrived. Two or three a week, not five a day.
--
-- Defaults to false because the two mistakes are not symmetrical.
-- Wrongly marked external fills the list with in-house results and
-- kills it; wrongly left internal loses a single row and the list
-- survives. The default is also right about three quarters of the
-- time, and somebody entering an external result already knows it
-- came from outside -- ticking the box is a deliberate act, where the
-- in-house case is a technician at the machine ticking nothing.
--
-- No back-fill: every existing row is left as in-house, which is the
-- honest default for data recorded before the question was asked.
--
-- Idempotent: safe to run against a database that already has it.

ALTER TABLE "diagnostics"
  ADD COLUMN IF NOT EXISTS "externalLab" BOOLEAN NOT NULL DEFAULT false;
