-- Which dose it was, and where the next date's interval came from.
--
-- TWO QUESTIONS THIS TABLE COULD NOT ANSWER, AND ONE OF THEM COSTS THE
-- OWNER MONEY. From the vet, 23 September 2026: "Karma üç doz, sahibi
-- ikinci dozdan sonra kayboluyor, üç ay sonra geliyor. O an sorduğum şey
-- 'en son ne zaman' değil, 'kaçıncı dozdaydık'. Emin olamayınca baştan
-- başlatıyorum, sahibi de boşuna para veriyor." A single `nextDueAt`
-- records when, never which -- so the vet restarts a three-dose series
-- they had almost finished, and the owner pays for it.
--
-- `seriesOf` is stored beside `doseNumber` rather than looked up, and
-- that is the whole reason it exists: a record states what was believed
-- on the day it was written. If the shipped list later says four doses,
-- a dose recorded as 2 of 3 stays 2 of 3. Reading the current catalogue
-- instead would quietly restate every history in the database.
--
-- `nextDueSource` is the second question: an interval this clinic has
-- measured for itself and one the product shipped are different claims,
-- and a screen showing them identically turns a default into a medical
-- fact nobody stated. Three values and no fourth: HISTORY (the clinic's
-- own records), LIST (what we shipped), MANUAL (a person typed it).
--
-- NOTHING IS BACK-FILLED, and that is deliberate. Every existing row has
-- a null source, which reads as "we do not know where this came from" --
-- which is true. Guessing LIST for them would put our claim on records
-- written before the list existed.
--
-- Idempotent: the type is created only if absent, and the columns use
-- IF NOT EXISTS. No data is read, changed or deleted.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DueSource') THEN
    CREATE TYPE "DueSource" AS ENUM ('HISTORY', 'LIST', 'MANUAL');
  END IF;
END $$;

ALTER TABLE "vaccinations" ADD COLUMN IF NOT EXISTS "nextDueSource" "DueSource";
ALTER TABLE "vaccinations" ADD COLUMN IF NOT EXISTS "doseNumber" INTEGER;
ALTER TABLE "vaccinations" ADD COLUMN IF NOT EXISTS "seriesOf" INTEGER;

-- NO INDEX, and the reason is written down so nobody adds one out of
-- habit. Both columns are read for ONE animal at a time, through
-- (clinicId, petId, administeredAt) which already exists and already
-- orders the rows the way the series is counted. An index on
-- `doseNumber` would serve no query this product makes, and every index
-- is paid for on each write.
