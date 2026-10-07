-- Two changes, one deployment, in this order.
--
-- 1. Every invoice carries the currency it was issued in. Until now money
--    was read through the clinic's *current* setting, so the first clinic to
--    switch from dollars to lira would have seen every past invoice restated
--    silently. The backfill takes each clinic's currency as it is TODAY, not
--    the one about to be chosen: that is what those invoices were issued in.
--    Running the backfill before the setting screen exists is deliberate —
--    afterwards the "today" value could already be the new one.
--
-- 2. New clinics start in lira. Existing clinics are NOT converted: their
--    column keeps whatever it holds and they change it from the settings
--    screen, which is why this migration and that screen ship together.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" TEXT;

UPDATE "invoices" i
SET "currency" = c."currency"
FROM "clinics" c
WHERE c.id = i."clinicId" AND i."currency" IS NULL;

-- Nothing can be left without one: an invoice with no currency is a number
-- with no meaning.
UPDATE "invoices" SET "currency" = 'TRY' WHERE "currency" IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "currency" SET NOT NULL;

ALTER TABLE "clinics" ALTER COLUMN "currency" SET DEFAULT 'TRY';
