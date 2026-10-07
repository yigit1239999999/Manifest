-- WhatsApp consent must be given, not assumed.
--
-- `notificationsOptIn` defaulted to true, so every client ever created was
-- marked as consenting without anyone asking them. A pre-ticked box is not
-- valid consent under KVKK or WhatsApp's own business policy, so the
-- default becomes false and existing rows are turned off.
--
-- That clears real data, so the old values are copied first. To restore
-- them:
--   UPDATE "clients" c SET "notificationsOptIn" = b."notificationsOptIn"
--   FROM "_whatsapp_opt_in_backup" b WHERE b."clientId" = c."id";
CREATE TABLE IF NOT EXISTS "_whatsapp_opt_in_backup" (
  "clientId"      TEXT PRIMARY KEY,
  "notificationsOptIn" BOOLEAN NOT NULL,
  "backedUpAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "_whatsapp_opt_in_backup" ("clientId", "notificationsOptIn")
SELECT "id", "notificationsOptIn" FROM "clients"
ON CONFLICT ("clientId") DO NOTHING;

ALTER TABLE "clients" ALTER COLUMN "notificationsOptIn" SET DEFAULT false;

UPDATE "clients" SET "notificationsOptIn" = false WHERE "notificationsOptIn" = true;
