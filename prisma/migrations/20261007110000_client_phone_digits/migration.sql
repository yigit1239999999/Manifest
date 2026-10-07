-- Finding a client by phone, however the number was written.
--
-- `searchKey` holds the phone exactly as typed, so "532 411" found
-- "0532 411 22 33" and missed "05324112233", "+90 (532) 411-22-33" and
-- "0532-411-22-33" (pm B5): the same owner, four spellings, one of them
-- findable. Imports bring every spelling a spreadsheet can hold.
--
-- A stored generated column, for the reason `searchKey` is one: the
-- database computes it on every write -- the client form, the visit's
-- new-owner block, the spreadsheet import, and any path written later --
-- so no caller can forget it, and existing rows are filled by this
-- statement itself. Nothing to back-fill by hand.
--
-- The rule: digits only, and the last ten of them when there are at least
-- ten. Ten is a Turkish national number without its trunk 0 or the 90
-- country code, so all four spellings above become "5324112233". A
-- shorter number keeps all its digits. The secondary phone follows after
-- a space, so a search finds either and never a run spanning both.
--
-- Additive and idempotent.
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "phoneDigits" text
  GENERATED ALWAYS AS (
    nullif(btrim(
      CASE
        WHEN length(regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g')) >= 10
          THEN right(regexp_replace("phone", '[^0-9]', '', 'g'), 10)
        ELSE regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g')
      END
      || ' ' ||
      CASE
        WHEN length(regexp_replace(coalesce("secondaryPhone", ''), '[^0-9]', '', 'g')) >= 10
          THEN right(regexp_replace("secondaryPhone", '[^0-9]', '', 'g'), 10)
        ELSE regexp_replace(coalesce("secondaryPhone", ''), '[^0-9]', '', 'g')
      END
    ), '')
  ) STORED;

-- `contains` for the search, as with `searchKey`: LIKE '%digits%' needs a
-- trigram index. The btree serves the exact match the duplicate-client
-- check asks ("is this number already on file in this clinic").
CREATE INDEX IF NOT EXISTS "clients_phoneDigits_trgm"
  ON "clients" USING gin ("phoneDigits" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "clients_clinicId_phoneDigits_idx"
  ON "clients" ("clinicId", "phoneDigits");
