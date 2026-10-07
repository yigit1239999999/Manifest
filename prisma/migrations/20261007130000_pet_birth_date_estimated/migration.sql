-- A birth date that is an estimate: an import read a year alone ("2021")
-- as 1 January of that year because the vet asked it to. Additive, with a
-- default that is true of every existing row (none of them were estimated).
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "birthDateEstimated" BOOLEAN NOT NULL DEFAULT false;
