-- Search that finds Ayşe when the vet types Ayse.
--
-- The pickers were fixed in the browser (components/ui/combobox.tsx), but
-- the server never folded accents at all: Prisma's `mode: "insensitive"`
-- compiles to ILIKE, which folds case and nothing else. Measured on this
-- database before the fix:
--
--   'Ayşe'   ILIKE '%Ayse%'   -> false
--   'Çiğdem' ILIKE '%Cigdem%' -> false
--   'Işık'   ILIKE '%Isik%'   -> false
--
-- That is the half of the defect people actually use: the command palette
-- (app/api/search/route.ts) calls quickSearchClients/quickSearchPets
-- directly, with no cap and no local list in front of it, so a clinic of
-- twelve was already being told "no such client" about a client it has.
--
-- A stored generated column rather than folding in the query. The
-- alternative -- lower(unaccent(col)) in a WHERE -- cannot use an index
-- and, more importantly, has to be remembered at every call site. A
-- generated column is folded by the database on every write, including
-- writes made by a future code path nobody has written yet.
--
-- unaccent() is STABLE because a dictionary can be reloaded, and a
-- generated column demands IMMUTABLE. The wrapper below pins the
-- dictionary by name and asserts immutability, which is the standard
-- workaround and is a promise about that dictionary: if anyone ever
-- redefines public.unaccent's rules, these columns must be rebuilt.
--
-- The application folds the search term in JavaScript (lib/search.ts) and
-- the two have to agree exactly, or the server answers a question the
-- browser did not ask. scripts/fold-parity.mjs compares them character by
-- character against this very function; it is not decoration, it is the
-- only thing standing between here and a silent disagreement.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- One key per row rather than one per column: the fields were already
-- searched as an OR, and joining them with a space also makes "ayse
-- demir" find a client whose first and last name are stored apart --
-- which it never did, and which is the first thing anyone types.
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "searchKey" text
  GENERATED ALWAYS AS (
    lower(public.immutable_unaccent(
      coalesce("firstName", '') || ' ' ||
      coalesce("lastName", '')  || ' ' ||
      coalesce("email", '')     || ' ' ||
      coalesce("phone", '')
    ))
  ) STORED;

-- The owner's name stays searchable from a pet through this same column,
-- one table over: a generated column cannot reach another table, and
-- duplicating the owner's name into the pet row would go stale the day
-- somebody marries.
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "searchKey" text
  GENERATED ALWAYS AS (
    lower(public.immutable_unaccent(
      coalesce("name", '')  || ' ' ||
      coalesce("breed", '') || ' ' ||
      coalesce("microchipId", '')
    ))
  ) STORED;

-- Trigram indexes, because every one of these searches is `contains`,
-- i.e. LIKE '%term%', which no btree index can serve. Until now the
-- search was a sequential scan over every client and every pet in the
-- clinic on every keystroke past the second; it was invisible at a
-- hundred rows and would not have stayed that way.
CREATE INDEX IF NOT EXISTS "clients_searchKey_trgm"
  ON "clients" USING gin ("searchKey" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "pets_searchKey_trgm"
  ON "pets" USING gin ("searchKey" gin_trgm_ops);
