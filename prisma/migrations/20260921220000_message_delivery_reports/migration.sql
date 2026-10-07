-- Delivery reports for messages the provider already accepted.
--
-- `SENT` says the operator took the message and has never said more than
-- that. Whether it reached a handset arrives later, from a separate call
-- to the provider, and sometimes never. So it is a second column, not a
-- widened meaning of the first.
--
-- UNKNOWN and PENDING are both "not delivered yet" and they are not the
-- same fact: UNKNOWN is ours (nobody has asked), PENDING is theirs
-- (asked, and they do not know yet). One nullable timestamp would have
-- folded those together, which is the defect this release spent the day
-- removing.
--
-- Idempotent: safe to run against a database that already has it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDeliveryStatus') THEN
    CREATE TYPE "MessageDeliveryStatus" AS ENUM (
      'UNKNOWN', 'PENDING', 'DELIVERED', 'UNDELIVERED', 'EXPIRED'
    );
  END IF;
END
$$;

ALTER TABLE "message_logs"
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCheckedAt" TIMESTAMP(3);

-- Every existing row keeps the honest answer: nobody has asked the
-- provider about any of them, and the default says exactly that rather
-- than implying they failed.

-- The poller reads accepted messages whose delivery is still open,
-- oldest first. Without this index that is a scan of every message the
-- clinic has ever sent, every fifteen minutes.
CREATE INDEX IF NOT EXISTS "message_logs_deliveryStatus_createdAt_idx"
  ON "message_logs" ("deliveryStatus", "createdAt");
