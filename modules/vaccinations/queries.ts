import { prisma } from "@/lib/prisma";
import { fold } from "@/lib/search";
import { intervalOf, type IntervalSuggestion } from "@/lib/vaccination-interval";
import {
  clinicVaccineList,
  normalizeVaccineSettings,
  offerByName,
  type DoseRow,
  type VaccineOffer,
} from "./catalogue";

export async function listVaccinationsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.vaccination.findMany({
    where: { clinicId, petId },
    orderBy: { administeredAt: "desc" },
    take,
    include: { administeredBy: { select: { id: true, name: true } } },
  });
}

/**
 * What the dashboard offers as work to do next.
 *
 * The animal filter is the point of this comment. Without it the card
 * listed vaccinations for animals that had died or been archived, and
 * the card is where the sending starts: a vet reads "Fındık's booster
 * is due", writes a reminder, and the far end of the chain is the only
 * thing that catches it -- the sweep refuses to send and the row says
 * why. That is the chain working from the middle onwards while its
 * first link hands out wrong work. Worse, nothing in the chain catches
 * a vet who picks up the phone instead.
 *
 * The same rule already lives in the reminder sweep's two queries and
 * in the animal picker. It was missing here, not weaker here.
 *
 * Two layers, not one, and the dashboard's own counts query was already
 * written that way: an archived owner is one the clinic no longer
 * serves, and their animal is not archived by that alone. Offering
 * their booster sends a vet to somebody they should not be calling --
 * the dead-animal case one level up.
 */
export async function upcomingVaccinations(clinicId: string, take = 10) {
  return prisma.vaccination.findMany({
    where: {
      clinicId,
      nextDueAt: { not: null, gte: new Date() },
      // A later dose of the same vaccine has answered this date.
      supersededById: null,
      pet: { deceased: false, archivedAt: null, owner: { archivedAt: null } },
    },
    orderBy: { nextDueAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true, ownerId: true } },
    },
  });
}

/** How far back the overdue card looks. Fixed, and the reason is below. */
export const OVERDUE_WINDOW_MONTHS = 6;

function overdueWhere(clinicId: string, now: Date) {
  const since = new Date(now);
  since.setMonth(since.getMonth() - OVERDUE_WINDOW_MONTHS);
  return {
    clinicId,
    // Past due, and not so long past that it is history rather than
    // work. Six months is a fixed window rather than a setting: a
    // clinic cannot answer "how far back should this look" without
    // already knowing what the card does, and every month added makes
    // the number bigger without making it more actionable.
    nextDueAt: { gte: since, lt: now },
    // Closed rows are closed. The stamp is on the vaccination, not the
    // animal, so this hides one line from one card and nothing else.
    dueDismissedAt: null,
    // Answered by a later dose of the same vaccine (catalogue aliases
    // included): re-vaccinated is not overdue. Derived, not a close --
    // see `supersede.ts`.
    supersededById: null,
    // The same two layers as the upcoming card. An overdue booster for
    // a dead animal is the worst version of this card, not a milder
    // one: it is the most urgent-looking row on the screen.
    pet: { deceased: false, archivedAt: null, owner: { archivedAt: null } },
  } as const;
}

/**
 * Vaccinations whose date has gone by and nobody has closed.
 *
 * Deliberately a different question from `upcomingVaccinations`, and
 * not a widening of it. "Upcoming" sorts by soonest and is a plan;
 * this sorts by longest overdue and is a backlog, and the animal that
 * has waited longest is the one the clinic has most likely lost.
 */
export async function overdueVaccinations(clinicId: string, take = 5, now = new Date()) {
  return prisma.vaccination.findMany({
    where: overdueWhere(clinicId, now),
    orderBy: { nextDueAt: "asc" },
    take,
    include: {
      pet: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          // So the dashboard row can offer the call it exists to prompt.
          owner: { select: { phone: true } },
        },
      },
    },
  });
}

/**
 * The count behind the card's heading, which is also what decides
 * whether the card exists at all: at zero it is not rendered, because
 * an empty "nothing is overdue" panel takes a place on the dashboard
 * every day to say something on the days it is least needed.
 */
export async function countOverdueVaccinations(clinicId: string, now = new Date()) {
  return prisma.vaccination.count({ where: overdueWhere(clinicId, now) });
}

/**
 * The overdue rows the card's window leaves out: past due for longer than
 * `OVERDUE_WINDOW_MONTHS`, not closed, animal and owner still served.
 *
 * Counted, not listed. The window stands -- the card is work, and a
 * three-year-old booster is history rather than this morning's call --
 * but a clinic that has just imported its file has a backlog that is
 * nearly all older than six months, and a dashboard that showed none of
 * it would have quietly swallowed the import's most useful fact. So the
 * card says how many are beyond it, and the import's result screen
 * counts by the same rule (`modules/import/service.ts` `dueCounts`).
 */
export async function countOlderOverdueVaccinations(clinicId: string, now = new Date()) {
  const since = new Date(now);
  since.setMonth(since.getMonth() - OVERDUE_WINDOW_MONTHS);
  return prisma.vaccination.count({
    where: {
      clinicId,
      nextDueAt: { lt: since },
      dueDismissedAt: null,
      supersededById: null,
      pet: { deceased: false, archivedAt: null, owner: { archivedAt: null } },
    },
  });
}

// What this clinic itself has done, offered back as a suggestion.
//
// The next-due date is the one field the whole return loop rests on and it
// is filled in about a fifth of the time. The app must not invent the
// answer — a wrong interval books a wrong reminder and nobody finds out
// (TEAM.md #14) — so the only thing it is allowed to say is what this
// clinic has repeatedly done for this vaccine on this species, together
// with the number of records it is saying it from.

/** Records older than this say nothing about how the clinic works now. */
const SUGGESTION_WINDOW = 12;
/** Below this there is no "usually" to speak of, so nothing is offered. */
const MIN_SAMPLE = 3;
/** The interval has to be the clinic's habit, not merely its most common. */
const MIN_SHARE = 0.5;

const DAY_MS = 86_400_000;

/**
 * Per vaccine name (lower-cased), the interval this clinic usually leaves
 * before the next dose of it, for animals of this species.
 *
 * Keyed by species because the answer differs by it, and computed for every
 * name at once rather than per keystroke: the form knows the animal, the
 * list of names a clinic uses is short, and a suggestion that needs a round
 * trip arrives after the vet has already moved on.
 */
export async function vaccinationIntervalSuggestions(
  clinicId: string,
  species: string,
): Promise<Record<string, IntervalSuggestion>> {
  const rows = await prisma.vaccination.findMany({
    where: {
      clinicId,
      nextDueAt: { not: null },
      pet: { species: species as never, archivedAt: null },
    },
    orderBy: { administeredAt: "desc" },
    // Enough to give every name its own window without reading the archive.
    take: SUGGESTION_WINDOW * 40,
    select: { name: true, administeredAt: true, nextDueAt: true },
  });

  const byName = new Map<string, { name: string; days: number }[]>();
  for (const row of rows) {
    if (!row.nextDueAt) continue;
    // Folded, not lower-cased, and the difference is a whole feature. The
    // shipped catalogue (`lib/vaccines.ts`) matches names with `fold()`, so
    // a key made with `toLowerCase()` agrees with it on "kuduz" and
    // disagrees on "köpek öksürüğü" -- the clinic's own measured interval
    // would reach the list for some vaccines and not for others, with
    // nothing on screen to say which. Two definitions of "the same name" is
    // the defect this repo has now closed three times.
    // Trimmed before folding: `fold` normalises letters, not whitespace,
    // and "Kuduz " typed with a stray space is the same vaccine.
    const key = fold(row.name.trim());
    if (!key) continue;
    const bucket = byName.get(key) ?? [];
    if (bucket.length >= SUGGESTION_WINDOW) continue;
    bucket.push({
      name: row.name,
      days: Math.round(
        (row.nextDueAt.getTime() - row.administeredAt.getTime()) / DAY_MS,
      ),
    });
    byName.set(key, bucket);
  }

  const suggestions: Record<string, IntervalSuggestion> = {};
  for (const [key, entries] of byName) {
    const counts = new Map<string, { interval: IntervalSuggestion; hits: number }>();
    for (const entry of entries) {
      const interval = intervalOf(entry.days);
      if (!interval) continue;
      const bucketKey = `${interval.unit}:${interval.value}`;
      const seen = counts.get(bucketKey);
      if (seen) seen.hits += 1;
      else
        counts.set(bucketKey, {
          interval: { ...interval, sampleSize: entries.length },
          hits: 1,
        });
    }

    let best: { interval: IntervalSuggestion; hits: number } | null = null;
    for (const candidate of counts.values()) {
      if (!best || candidate.hits > best.hits) best = candidate;
    }
    // No habit, no chip. A clinic that has written three different intervals
    // for the same vaccine has not told us anything, and guessing at that
    // point is the invention the rule forbids.
    if (!best) continue;
    if (entries.length < MIN_SAMPLE) continue;
    if (best.hits / entries.length < MIN_SHARE) continue;
    suggestions[key] = best.interval;
  }
  return suggestions;
}


/**
 * This clinic's vaccine list for one animal, and how many doses that animal
 * has already had of each.
 *
 * Three reads and no more, whatever the list's length: the clinic's own
 * settings, the interval history for the species, and this animal's own
 * vaccinations. Counting the doses per vaccine in a loop would be a query
 * per line of the list, on a screen a vet opens all day.
 *
 * WHY THE DOSE COUNT IS HERE AT ALL. "Karma üç doz, sahibi ikinci dozdan
 * sonra kayboluyor, üç ay sonra geliyor. O an sorduğum şey 'en son ne
 * zaman' değil, 'kaçıncı dozdaydık'." The form can only propose "this is
 * dose 3 of 3" if somebody has counted the first two, and the count has to
 * follow the vaccine through its renames -- a dose written last year under
 * the old long name is still one of the three.
 */
export async function vaccineOffersForPet(
  clinicId: string,
  petId: string,
  species: string,
): Promise<{
  offers: VaccineOffer[];
  priorDoses: Record<string, number>;
  /**
   * The same rows the counts are made of, for the two questions the pet
   * page asks of them (#45). Returned rather than re-read: this query
   * already reads every vaccination this animal has, and asking again
   * for four more columns of the same rows would be a second round trip
   * for data already in hand.
   */
  doses: DoseRow[];
}> {
  const [clinic, history, given] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } }),
    vaccinationIntervalSuggestions(clinicId, species),
    prisma.vaccination.findMany({
      where: { clinicId, petId },
      select: {
        name: true,
        administeredAt: true,
        nextDueAt: true,
        doseNumber: true,
        seriesOf: true,
      },
      // A series is three doses and an animal's whole record is short; this
      // is a ceiling against a pathological row count, not a page size.
      take: 200,
    }),
  ]);

  const settings = normalizeVaccineSettings(
    ((clinic?.settings ?? {}) as { vaccines?: unknown }).vaccines,
  );
  const offers = clinicVaccineList(species, settings, history);

  const priorDoses: Record<string, number> = {};
  for (const row of given) {
    const offer = offerByName(offers, row.name);
    if (!offer) continue;
    priorDoses[offer.key] = (priorDoses[offer.key] ?? 0) + 1;
  }
  return { offers, priorDoses, doses: given };
}

/**
 * This clinic's changes to the shipped vaccine list, for the settings
 * screen. The list itself is code; only the difference is stored.
 */
export async function getVaccineSettings(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { settings: true },
  });
  return normalizeVaccineSettings(
    ((clinic?.settings ?? {}) as { vaccines?: unknown }).vaccines,
  );
}
