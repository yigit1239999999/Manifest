-- Both pet lists read newest-first — the grid on /pets and the dropdown
-- that fills the form selects — and no index could hand them over in that
-- order. `EXPLAIN` shows a Sort above the scan on both the default path and
-- the one that includes archived rows, with the LIMIT applied after it.
--
-- The clinic's own index (`clinicId`) narrows the scan and does nothing for
-- the ordering, so the sort grows with the clinic's animals while the page
-- size stays at 24. Nothing is measurable today: the largest clinic here has
-- around a hundred animals. The evidence is the plan, as it was for the
-- vaccination suggestion, and the reason to add it now is that the cost of
-- adding an index rises with the table it is added to.
--
-- Not partial: unlike the vaccination index there is no predicate to narrow
-- by. Archived animals are excluded on one path and included on the other,
-- so an index over only the live ones would serve half the queries and
-- leave the archived view sorting.
CREATE INDEX IF NOT EXISTS "pets_clinicId_createdAt_idx"
  ON "pets" ("clinicId", "createdAt" DESC);
