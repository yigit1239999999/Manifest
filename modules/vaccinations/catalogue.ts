import { fold } from "@/lib/search";
import type { IntervalSuggestion } from "@/lib/vaccination-interval";
import {
  vaccineKeys,
  vaccinesForSpecies,
  type Vaccine,
  type VaccineNote,
  type VaccineSeries,
  type WeekRange,
} from "@/lib/vaccines";

/**
 * What this clinic's vaccine list actually is: what we shipped, what they
 * changed about it, and what their own records say about the intervals.
 *
 * WHERE THE CLINIC'S CHANGES LIVE, AND WHY NOT IN A TABLE. They go in
 * `Clinic.settings.vaccines`, the same place `enabledSpecies` lives, and for
 * the same reason: this is configuration about a list, not records. It is
 * bounded by a person curating it, nothing joins to it, no query filters or
 * sorts by it, and it is read once per form render alongside the clinic. A
 * table would buy indexes nothing would use and cost a second write path.
 *
 * The one real cost, written down rather than discovered later: `settings`
 * is a single JSON column, so two settings screens saved in the same second
 * can lose one another's key. That is already true of every other key in
 * there; this adds one more, and does not make it worse in kind.
 *
 * THE ORDER OF PRECEDENCE IS THE WHOLE FILE, and it is the task's rule:
 *
 *   1. what the clinic typed for this vaccine   (they said it outright)
 *   2. what the clinic's own records show       (they did it repeatedly)
 *   3. what the product shipped                 (we said it)
 *   4. "ask"                                    (the list admits it cannot say)
 *   5. nothing
 *
 * Two above three is the rule the task states plainly: a clinic that has
 * written "Kuduz 400 gün" twice gets 400, not our 365. One above two is the
 * same rule one step further -- saying it is stronger evidence than doing
 * it, and a vet who changes the number has already seen their own habit.
 *
 * And four is not the floor. A list entry that says "ask" only means WE have
 * no answer; if the clinic's records have one, it wins, because the reason
 * we are silent about kennel cough is that this vet could not decide -- not
 * that the question has no answer anywhere.
 */

export interface VaccineInterval {
  unit: "week" | "month" | "year";
  value: number;
}

/** A vaccine this clinic added for itself. */
export interface ClinicVaccine {
  species: string;
  name: string;
  interval?: VaccineInterval;
}

export interface VaccineSettings {
  /** Catalogue keys the clinic has taken off its list (ŞART C). */
  hidden: string[];
  /** Per catalogue key, an interval the clinic set by hand. */
  intervals: Record<string, VaccineInterval>;
  /** Entries of the clinic's own. */
  added: ClinicVaccine[];
}

const UNITS = new Set(["week", "month", "year"]);

function normalizeInterval(input: unknown): VaccineInterval | null {
  if (typeof input !== "object" || input === null) return null;
  const { unit, value } = input as { unit?: unknown; value?: unknown };
  if (typeof unit !== "string" || !UNITS.has(unit)) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return null;
  return { unit: unit as VaccineInterval["unit"], value };
}

/**
 * The settings block, read defensively.
 *
 * Anything unrecognised is dropped rather than repaired: a half-understood
 * override would propose a date, and a proposed date is a claim. Missing is
 * the safe direction here -- it costs one question and invents nothing.
 */
export function normalizeVaccineSettings(input: unknown): VaccineSettings {
  const raw = (typeof input === "object" && input !== null ? input : {}) as {
    hidden?: unknown;
    intervals?: unknown;
    added?: unknown;
  };

  const hidden = Array.isArray(raw.hidden)
    ? [...new Set(raw.hidden.filter((k): k is string => typeof k === "string"))]
    : [];

  const intervals: Record<string, VaccineInterval> = {};
  if (typeof raw.intervals === "object" && raw.intervals !== null) {
    for (const [key, value] of Object.entries(raw.intervals)) {
      const interval = normalizeInterval(value);
      if (interval) intervals[key] = interval;
    }
  }

  const added: ClinicVaccine[] = [];
  if (Array.isArray(raw.added)) {
    for (const entry of raw.added) {
      if (typeof entry !== "object" || entry === null) continue;
      const { species, name, interval } = entry as Record<string, unknown>;
      if (typeof species !== "string" || species.trim() === "") continue;
      if (typeof name !== "string" || name.trim() === "") continue;
      const parsed = normalizeInterval(interval);
      added.push({
        species,
        name: name.trim(),
        ...(parsed ? { interval: parsed } : {}),
      });
    }
  }

  return { hidden, intervals, added };
}

/** Why the next-due interval on screen is the number it is. */
export type DueProposal =
  /** This clinic's own records, with how many they are counted from. */
  | { kind: "history"; interval: VaccineInterval; sampleSize: number }
  /** The clinic set this by hand for this vaccine. */
  | { kind: "clinic"; interval: VaccineInterval }
  /** The list the product ships with. */
  | { kind: "list"; interval: VaccineInterval }
  /** The list carries this vaccine and says the date has to be asked for. */
  | { kind: "ask" }
  /** Nothing is known, by anybody, and the screen says nothing. */
  | { kind: "none" };

/** One line of a clinic's list, ready for the picker and the form. */
export interface VaccineOffer {
  /** Catalogue key, or `clinic:<folded name>` for the clinic's own. */
  key: string;
  name: string;
  bookName?: string;
  note?: VaccineNote;
  startAt?: WeekRange;
  series?: VaccineSeries;
  due: DueProposal;
}

function offerFor(
  vaccine: Vaccine,
  settings: VaccineSettings,
  history: Record<string, IntervalSuggestion>,
): VaccineOffer {
  // History is keyed by the written name, and this vaccine answers to
  // several: the one it has now and every one it has had. A clinic that
  // wrote the old long name for a year is the case this loop exists for.
  let measured: IntervalSuggestion | undefined;
  for (const key of vaccineKeys(vaccine)) {
    const found = history[key];
    if (found && (!measured || found.sampleSize > measured.sampleSize)) measured = found;
  }

  const override = settings.intervals[vaccine.key];
  const due: DueProposal = override
    ? { kind: "clinic", interval: override }
    : measured
      ? {
          kind: "history",
          interval: { unit: measured.unit, value: measured.value },
          sampleSize: measured.sampleSize,
        }
      : vaccine.adult.kind === "every"
        ? {
            kind: "list",
            interval: { unit: vaccine.adult.unit, value: vaccine.adult.value },
          }
        : { kind: "ask" };

  return {
    key: vaccine.key,
    name: vaccine.name,
    ...(vaccine.bookName ? { bookName: vaccine.bookName } : {}),
    ...(vaccine.note ? { note: vaccine.note } : {}),
    ...(vaccine.startAt ? { startAt: vaccine.startAt } : {}),
    ...(vaccine.series ? { series: vaccine.series } : {}),
    due,
  };
}

/**
 * This clinic's list for one animal: the shipped entries it has not hidden,
 * then the ones it added itself.
 *
 * `history` is what `vaccinationIntervalSuggestions` measured for this
 * species, keyed by folded name. It is passed in rather than fetched so this
 * stays a pure function -- the precedence rule is the part worth testing,
 * and a rule that needs a database to exercise gets tested once and then
 * never again.
 */
export function clinicVaccineList(
  species: string,
  settings: VaccineSettings,
  history: Record<string, IntervalSuggestion> = {},
): VaccineOffer[] {
  const hidden = new Set(settings.hidden);
  const offers = vaccinesForSpecies(species)
    .filter((vaccine) => !hidden.has(vaccine.key))
    .map((vaccine) => offerFor(vaccine, settings, history));

  for (const own of settings.added) {
    if (own.species !== species) continue;
    const folded = fold(own.name);
    const measured = history[folded];
    offers.push({
      key: `clinic:${folded}`,
      name: own.name,
      due: own.interval
        ? { kind: "clinic", interval: own.interval }
        : measured
          ? {
              kind: "history",
              interval: { unit: measured.unit, value: measured.value },
              sampleSize: measured.sampleSize,
            }
          : // Added with no interval and no history behind it yet. Not
            // "ask" -- that is the list admitting to a question it knows
            // about, and nobody has asked anything here.
            { kind: "none" },
    });
  }

  return offers;
}

/** The offer a written name belongs to, for a form that starts from a name. */
export function offerByName(offers: readonly VaccineOffer[], name: string): VaccineOffer | null {
  const wanted = fold(name.trim());
  if (wanted === "") return null;
  return (
    offers.find(
      (offer) => fold(offer.name) === wanted || offer.key === `clinic:${wanted}`,
    ) ?? null
  );
}
