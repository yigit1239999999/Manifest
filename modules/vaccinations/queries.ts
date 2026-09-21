import { prisma } from "@/lib/prisma";
import { intervalOf, type IntervalSuggestion } from "@/lib/vaccination-interval";

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

export async function upcomingVaccinations(clinicId: string, take = 10) {
  return prisma.vaccination.findMany({
    where: {
      clinicId,
      nextDueAt: { not: null, gte: new Date() },
    },
    orderBy: { nextDueAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true, ownerId: true } },
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
    const key = row.name.trim().toLowerCase();
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
