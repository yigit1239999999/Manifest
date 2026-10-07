-- A visit's total carries the currency it was recorded in, the way an
-- invoice's has since `20260921110000_invoice_currency_and_try_default`.
--
-- Without it `/visits/[id]` printed `totalCents` with the clinic's CURRENT
-- setting, so a clinic switching from dollars to lira silently restated
-- every visit it had ever recorded — exactly the fault `Invoice.currency`
-- was added to prevent, one table over. The scan that was meant to catch
-- this looked for money being summed, and a visit total is a single value,
-- so it slipped through: the pattern that finds it is "money stored
-- without the currency it was stored in".
--
-- Backfilled from each clinic's currency AS IT IS NOW, not from whatever is
-- chosen later. That is the value those visits were priced in, and it is
-- knowable today and unknowable once the setting moves. Three visits carry
-- a total as this runs — two in a dollar clinic, one in a lira clinic — so
-- the backfill is small and unambiguous, which is the argument for doing it
-- now rather than when it is neither.
--
-- Nullable, unlike the invoice column: `totalCents` is itself optional, and
-- a visit with no total has no currency to record. The pair is what matters
-- — a total without a currency is a number with no meaning — and the
-- application writes both together.
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "currency" TEXT;

UPDATE "visits" v
SET "currency" = c."currency"
FROM "clinics" c
WHERE c.id = v."clinicId"
  AND v."totalCents" IS NOT NULL
  AND v."currency" IS NULL;
