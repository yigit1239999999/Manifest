-- WhatsApp consent must be given, not assumed.
--
-- `whatsappOptIn` defaulted to true, so every client ever created was
-- marked as consenting without anyone asking them. A pre-ticked box is not
-- valid consent under KVKK or WhatsApp's own business policy, so the
-- default becomes false and existing rows are turned off.
--
-- That clears real data, so the old values are copied first. To restore
-- them:
--   UPDATE "clients" c SET "whatsappOptIn" = b."whatsappOptIn"
--   FROM "_whatsapp_opt_in_backup" b WHERE b."clientId" = c."id";
CREATE TABLE IF NOT EXISTS "_whatsapp_opt_in_backup" (
  "clientId"      TEXT PRIMARY KEY,
  "whatsappOptIn" BOOLEAN NOT NULL,
  "backedUpAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "_whatsapp_opt_in_backup" ("clientId", "whatsappOptIn")
SELECT "id", "whatsappOptIn" FROM "clients"
ON CONFLICT ("clientId") DO NOTHING;

ALTER TABLE "clients" ALTER COLUMN "whatsappOptIn" SET DEFAULT false;

UPDATE "clients" SET "whatsappOptIn" = false WHERE "whatsappOptIn" = true;
