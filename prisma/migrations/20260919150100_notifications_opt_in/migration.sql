-- Channel-agnostic naming: the client's consent covers SMS and WhatsApp.

-- AlterTable
ALTER TABLE "clients" RENAME COLUMN "whatsappOptIn" TO "notificationsOptIn";

-- AlterTable
ALTER TABLE "message_logs" ALTER COLUMN "channel" SET DEFAULT 'SMS';
