-- Broaden the built-in species list so mixed and large-animal practices
-- (equine, farm) and common exotics no longer need a custom species.
-- Values are inserted in display order. Requires PostgreSQL 12+ (Supabase
-- runs 15+), where several ADD VALUE statements may share one migration.

-- AlterEnum
ALTER TYPE "Species" ADD VALUE 'FERRET' BEFORE 'REPTILE';
ALTER TYPE "Species" ADD VALUE 'AMPHIBIAN' BEFORE 'FISH';
ALTER TYPE "Species" ADD VALUE 'HORSE' BEFORE 'EXOTIC';
ALTER TYPE "Species" ADD VALUE 'CATTLE' BEFORE 'EXOTIC';
ALTER TYPE "Species" ADD VALUE 'SHEEP' BEFORE 'EXOTIC';
ALTER TYPE "Species" ADD VALUE 'GOAT' BEFORE 'EXOTIC';
