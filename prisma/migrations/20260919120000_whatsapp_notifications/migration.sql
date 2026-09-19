-- WhatsApp appointment notifications: client language + outbound message log.

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "preferredLanguage" TEXT;
ALTER TABLE "clients" ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP');
CREATE TYPE "MessageKind" AS ENUM ('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'REMINDER_DUE');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'FAILED', 'MANUAL');

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "clientId" TEXT,
    "reminderId" TEXT,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "kind" "MessageKind" NOT NULL,
    "recipient" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_logs_clinicId_createdAt_idx" ON "message_logs"("clinicId", "createdAt");
CREATE INDEX "message_logs_appointmentId_kind_idx" ON "message_logs"("appointmentId", "kind");
CREATE INDEX "message_logs_reminderId_kind_idx" ON "message_logs"("reminderId", "kind");

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
