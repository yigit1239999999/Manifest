import { duplicateRecord } from "./errors";

/**
 * The minute `at` falls in, as a Prisma range.
 *
 * A clinical record (a vaccination, a treatment, a test) for the same
 * animal, under the same name, in the same minute is a second press of the
 * save button, not a second dose: the forms keep their default time to the
 * minute, so two genuine records a minute apart still save. Found on Badem,
 * who had two "Lyme" at 08:40 because the form kept the name after saving.
 */
export function sameMinute(at: Date): { gte: Date; lt: Date } {
  const start = new Date(at);
  start.setUTCSeconds(0, 0);
  return { gte: start, lt: new Date(start.getTime() + 60_000) };
}

/** Throws the "already recorded" refusal when `existing` found a row. */
export function refuseDuplicate(existing: unknown, name: string): void {
  if (existing) throw duplicateRecord(name);
}
