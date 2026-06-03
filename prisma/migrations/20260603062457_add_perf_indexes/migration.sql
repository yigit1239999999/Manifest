-- Performance indexes for high-cardinality search columns.
--
-- These indexes match the common WHERE clauses in modules/*/queries.ts
-- after the soft-delete cascade in step 6 and the search paths that the
-- ⌘K command palette exercises on every keystroke.
--
-- All indexes are btree (Prisma's default). Trigram / GIN indexes for
-- the ILIKE search columns ship as a separate migration so they can be
-- applied in a maintenance window with `CONCURRENTLY` if needed.

-- Client search: email / phone lookups and archivedAt filters
CREATE INDEX "clients_clinicId_email_idx" ON "clients"("clinicId", "email");
CREATE INDEX "clients_clinicId_phone_idx" ON "clients"("clinicId", "phone");
CREATE INDEX "clients_clinicId_archivedAt_idx" ON "clients"("clinicId", "archivedAt");

-- Pet identity / archive filters
CREATE INDEX "pets_clinicId_microchipId_idx" ON "pets"("clinicId", "microchipId");
CREATE INDEX "pets_clinicId_archivedAt_idx" ON "pets"("clinicId", "archivedAt");

-- Appointments status filters (e.g. /appointments?status=SCHEDULED)
CREATE INDEX "appointments_clinicId_status_startsAt_idx" ON "appointments"("clinicId", "status", "startsAt");

-- Visit archive filter
CREATE INDEX "visits_clinicId_archivedAt_idx" ON "visits"("clinicId", "archivedAt");
