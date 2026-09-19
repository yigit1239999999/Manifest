-- SMS becomes a first-class channel. Adding the enum value lives in its own
-- migration: PostgreSQL refuses to use a freshly added enum value inside the
-- same transaction that created it.

-- AlterEnum
ALTER TYPE "MessageChannel" ADD VALUE 'SMS' BEFORE 'WHATSAPP';
