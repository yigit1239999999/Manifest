-- The next-due suggestion reads the clinic's own vaccination history on
-- every visit to /pets/[id] and /visits/[id], newest first
-- (`vaccinationIntervalSuggestions`). Without this index Postgres filters by
-- clinic and then SORTS the whole qualifying set to take the newest few —
-- `EXPLAIN` shows a Sort node above the scan, and the sort grows with the
-- clinic's history while the LIMIT does not bound it.
--
-- Today that costs nothing: the busiest clinic has three vaccinations, and
-- no timing here would show anything. The evidence is the shape of the plan,
-- not a measurement, and the reason to add it now rather than when it hurts
-- is that the cost of adding it is the same either way while the cost of
-- finding it later is a slow screen nobody can explain.
--
-- Partial, because the query only ever wants doses that have a next date —
-- one in five today — so the index stays a fraction of the table. DESC to
-- match the order the query reads in, so the scan can stop at the limit
-- instead of sorting.
CREATE INDEX IF NOT EXISTS "vaccinations_clinic_administeredAt_due_idx"
  ON "vaccinations" ("clinicId", "administeredAt" DESC)
  WHERE "nextDueAt" IS NOT NULL;
