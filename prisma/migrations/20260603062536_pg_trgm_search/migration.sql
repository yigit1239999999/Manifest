-- Trigram-backed search for the ILIKE '%term%' patterns used by the
-- ⌘K command palette and the /clients + /pets search boxes.
--
-- Without these indexes, every keystroke triggers a sequential scan.
-- With GIN + gin_trgm_ops, the same query lands on an index seek and
-- stays under a few milliseconds even with 100k+ clients per clinic.
--
-- pg_trgm ships with PostgreSQL; CREATE EXTENSION IF NOT EXISTS is
-- idempotent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Client search: first/last/email
CREATE INDEX "clients_firstName_trgm_idx" ON "clients" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX "clients_lastName_trgm_idx" ON "clients" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX "clients_email_trgm_idx" ON "clients" USING GIN ("email" gin_trgm_ops);

-- Pet search: name / breed / microchip
CREATE INDEX "pets_name_trgm_idx" ON "pets" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "pets_breed_trgm_idx" ON "pets" USING GIN ("breed" gin_trgm_ops);
CREATE INDEX "pets_microchipId_trgm_idx" ON "pets" USING GIN ("microchipId" gin_trgm_ops);
