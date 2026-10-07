-- The clinic time zone drives every message time and, from now on, every
-- time shown in the app. "UTC" was never a choice a clinic made — it was
-- the column default, and it made a clinic in Istanbul read three hours
-- early. This product ships Turkish-first, so the default becomes
-- Europe/Istanbul and clinics still sitting on the old default move with
-- it. A clinic that deliberately picked another zone is left alone.
ALTER TABLE "clinics" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Istanbul';

UPDATE "clinics" SET "timezone" = 'Europe/Istanbul' WHERE "timezone" = 'UTC';
