-- An animal cannot be in two places at one instant, so the same animal at
-- the same start time is never a second appointment.
--
-- The application already refuses to make one: `createAppointment` reads and
-- writes inside a serializable transaction and returns the appointment that
-- exists rather than creating another. This is the second belt. Two clients
-- racing on separate connections is the case the read-then-write cannot see
-- on its own, and a duplicate here is not a cosmetic problem: the owner gets
-- the confirmation message twice.
--
-- Partial, excluding cancelled ones, and the exclusion is the whole subtlety.
-- An owner who cancels and rings back an hour later is booking the slot again
-- for real; a unique index over every status would refuse them, which is the
-- database inventing a rule the clinic does not have. Every other status
-- means the booking already exists — a no-show or a finished visit at that
-- instant is history, not a slot to fill.
--
-- Written by hand rather than through the schema because Prisma cannot
-- express a partial unique index; `prisma/schema.prisma` carries the same
-- rule as a comment so the next person reading the model finds it there too.
--
-- One duplicate pair existed when this was written (two identical rows 74
-- seconds apart, from a slow route during testing) and was removed with the
-- owner's approval before this ran. Without that, creating the index fails.
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_clinic_pet_startsAt_open_key"
  ON "appointments" ("clinicId", "petId", "startsAt")
  WHERE status <> 'CANCELLED';
