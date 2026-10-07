// The arithmetic behind the next-due suggestion, with no database and no
// React in it, because both sides need it: the query works out what the
// clinic usually does (`modules/vaccinations/queries.ts`) and the form works
// out which date that lands on (`components/forms/vaccination-form.tsx`).
//
// Kept out of `lib/format.ts` on purpose — nothing here formats anything,
// and that file is already a mixed bag.

export interface Interval {
  /** The unit a vet says out loud. Never raw days. */
  unit: "week" | "month" | "year";
  value: number;
}

export interface IntervalSuggestion extends Interval {
  /** How many past records the suggestion is drawn from; shown to the user. */
  sampleSize: number;
}

/** Mean Gregorian month, so "12 months" and "1 year" land on one bucket. */
const MONTH_DAYS = 30.436875;

/**
 * The unit a gap of this many days is naturally expressed in.
 *
 * `null` below three days: a schedule is not what that gap is, and rounding
 * it to "0 weeks" would put a meaningless chip in front of the vet.
 */
export function intervalOf(days: number): Interval | null {
  if (days < 3) return null;
  if (days <= 45) return { unit: "week", value: Math.round(days / 7) };
  const months = Math.round(days / MONTH_DAYS);
  if (months % 12 === 0) return { unit: "year", value: months / 12 };
  return { unit: "month", value: months };
}

/**
 * `2026-03-14` plus an interval, as another `YYYY-MM-DD` string.
 *
 * Calendar arithmetic on the date parts rather than on a timestamp: adding
 * "1 year" to 14 March has to give 14 March, not a day either side of it
 * because a leap day or a daylight-saving change happened in between. The
 * last day of a short month is clamped, so 31 January plus one month is
 * 28 February rather than spilling into March.
 */
export function addInterval(date: string, interval: Interval): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  const months =
    interval.unit === "year"
      ? interval.value * 12
      : interval.unit === "month"
        ? interval.value
        : 0;
  const days = interval.unit === "week" ? interval.value * 7 : 0;

  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay) + days);

  return target.toISOString().slice(0, 10);
}
