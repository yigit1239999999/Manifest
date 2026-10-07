-- "Köpek" and "Kopek" were two species.
--
-- A clinic grows its own species list, and a new name is deduplicated
-- against the existing ones with `mode: "insensitive"` -- ILIKE, which
-- folds case and nothing else. So a vet typing without Turkish letters,
-- or in a hurry, created a second row: the picker then offered both
-- forever, animals were filed under either, and no screen ever said the
-- two were the same animal kind. Unlike a search that misses, this one
-- writes. The row it leaves behind is permanent and nothing in the
-- product can merge it back.
--
-- Same folding as `clients.searchKey` and `pets.searchKey`
-- (20260921190000), reusing the same immutable wrapper, so there is one
-- definition of "the same name" in the database and one in the
-- application (lib/search.ts, checked by scripts/fold-parity.mjs).
--
-- The unique index is the part that matters. The dedupe read in
-- `resolveSpecies` can always lose a race with a second request: two
-- vets adding "Papağan" in the same second both find nothing and both
-- insert. A check cannot fix that and an index can, so the check is now
-- only there to give the ordinary case a good answer -- correctness
-- lives here.
--
-- Safe to apply as written: measured before adding it, this database
-- holds one custom species in total and no pair folds together, so
-- nothing has to be merged first. A database that does have a pair will
-- refuse this migration rather than pick a winner, which is the right
-- failure -- choosing which of two species names survives is not a
-- decision a migration should make quietly.
ALTER TABLE "custom_species"
  ADD COLUMN IF NOT EXISTS "nameKey" text
  GENERATED ALWAYS AS (lower(public.immutable_unaccent("name"))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS "custom_species_clinicId_nameKey_key"
  ON "custom_species" ("clinicId", "nameKey");
