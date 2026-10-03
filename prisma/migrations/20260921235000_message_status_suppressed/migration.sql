-- A message composed and deliberately not sent.
--
-- Two reminders for one animal on one day compose the same words: the
-- SMS text is built from the owner, the animal, the type and the day,
-- and neither the title nor the body reaches it. Sending both delivers
-- the same sentence to the same number twice.
--
-- The one that is held back needs a row of its own. Left with nothing,
-- it is indistinguishable from a reminder still waiting its turn -- the
-- screen would promise a send that is never coming, and the sweep would
-- reconsider it on every run for ever.
--
-- Not FAILED: nothing refused it, and it must not spend one of the
-- reminder's three attempts. Not SENT: nothing went.
--
-- Alone in its own migration because PostgreSQL cannot add an enum
-- value and use it in the same transaction.

ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';
