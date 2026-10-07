-- Consent becomes three states: null (nobody asked), true (agreed),
-- false (refused).
--
-- The column was BOOLEAN NOT NULL DEFAULT false, so every client was
-- recorded as having refused at the moment the record was created, before
-- anyone had spoken to them. Nothing on any screen told the two apart, so
-- a clinic reading its own data could not know which of its clients had
-- said no and which had never been asked. Dropping the default is what
-- makes a new client born unasked; dropping NOT NULL is what lets the
-- answer be missing rather than invented.
--
-- Existing true stays: somebody agreed, and that is a fact.
-- Existing false becomes null: the default wrote it, so it is not an
-- answer. The sweep runs here and only here -- a false written after this
-- migration IS an answer, and nothing may ever clear it again.
--
-- The counts are measured as this runs, and printed. Written into this
-- comment instead they would be a number from whenever the sentence was
-- typed, against whichever database that was; this session has already
-- carried three stale counts between messages.
--
-- The old values are not copied anywhere. A backup column outlives the
-- reason it was made and then misleads whoever finds it next
-- (_whatsapp_opt_in_backup, removed today for exactly that).
--
-- Idempotent: the UPDATE matches nothing on a second run, and both ALTERs
-- are no-ops once applied.
ALTER TABLE "clients" ALTER COLUMN "notificationsOptIn" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "notificationsOptIn" DROP NOT NULL;

DO $$
DECLARE
  unasked bigint;
  agreed  bigint;
  refused bigint;
BEGIN
  UPDATE "clients" SET "notificationsOptIn" = NULL WHERE "notificationsOptIn" = false;
  GET DIAGNOSTICS unasked = ROW_COUNT;

  SELECT count(*) FILTER (WHERE "notificationsOptIn" IS TRUE),
         count(*) FILTER (WHERE "notificationsOptIn" IS FALSE)
    INTO agreed, refused
    FROM "clients";

  RAISE NOTICE 'notificationsOptIn: % rows false -> null (never asked), % true (agreed), % false (refused)',
    unasked, agreed, refused;
END $$;
