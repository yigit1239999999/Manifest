-- The surname the counter is not allowed to ask for.
--
-- From the vet, about the client standing in front of them: "I do not
-- know the surname of the lady who brings the street cat, and asking
-- would be rude. If you force it I will type a full stop, and the
-- record becomes rubbish." A required field does not produce the fact
-- it demands; it produces whatever gets past it.
--
-- Nullable rather than an empty string, which was the other way out.
-- "Nobody asked" and "there is none" are different, only one of them
-- is a fact, and an empty string is neither: it sorts as a real value
-- ahead of every name, it feeds `searchKey` as a real value, and it
-- makes "how many clients have no surname" unanswerable six months
-- from now. This is the distinction `Client.notificationsOptIn` exists
-- to keep, in the same table, decided the same way.
--
-- Nothing is lost and nothing is back-filled: every existing row has a
-- surname and keeps it. `searchKey` already wraps this column in
-- coalesce(), so the generated column and the full-name search carry
-- on unchanged -- checked before writing this, not assumed.
--
-- The index on (clinicId, lastName, firstName) stays. Postgres indexes
-- nulls, and a client without a surname sorts last rather than
-- disappearing from the list.
--
-- Idempotent: dropping a constraint that is already gone is a no-op.

ALTER TABLE "clients"
  ALTER COLUMN "lastName" DROP NOT NULL;
