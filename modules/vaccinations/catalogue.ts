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

export type VaccineInterval = {
  unit: "week" | "month" | "year";
  value: number;
};

/** A vaccine this clinic added for itself. */
export type ClinicVaccine = {
  species: string;
  name: string;
  interval?: VaccineInterval;
};

export type VaccineSettings = {
  /** Catalogue keys the clinic has taken off its list (ŞART C). */
  hidden: string[];
  /** Per catalogue key, an interval the clinic set by hand. */
  intervals: Record<string, VaccineInterval>;
  /** Entries of the clinic's own. */
  added: ClinicVaccine[];
};

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
  /**
   * Every folded name this offer answers to, including its current one.
   *
   * Carried on the offer rather than looked up again, because the thing
   * that needs it most is counting an animal's past doses: a dose written
   * last year under the old long name is still one of the three, and a
   * count that only matches today's name would restart a series the vet
   * had almost finished -- which is the exact failure this feature exists
   * to stop.
   */
  names: readonly string[];
  bookName?: string;
  note?: VaccineNote;
  startAt?: WeekRange;
  series?: VaccineSeries;
  /** See `Vaccine.official`: the one an outside authority asks about. */
  official?: true;
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
    names: vaccineKeys(vaccine),
    ...(vaccine.bookName ? { bookName: vaccine.bookName } : {}),
    ...(vaccine.note ? { note: vaccine.note } : {}),
    ...(vaccine.startAt ? { startAt: vaccine.startAt } : {}),
    ...(vaccine.series ? { series: vaccine.series } : {}),
    ...(vaccine.official ? { official: vaccine.official } : {}),
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
      names: [folded],
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
  const exact = offers.find((offer) => offer.names.includes(wanted));
  if (exact) return exact;
  // Second, the name as people write it around the vaccine: "Karma aşı",
  // "Kuduz aşısı", or the picker's own label "Karma (DHPPi)" written back
  // by an import. Without this an adult dog with last year's "Karma aşı"
  // had no prior dose and was offered the puppy series (pm, B8), and a
  // new "Karma" did not answer the old row's due date (A1).
  const loose = looseVaccineName(wanted);
  if (loose === "") return null;
  return (
    offers.find((offer) =>
      offer.names.some((n) => n === loose || looseVaccineName(n) === loose),
    ) ?? null
  );
}

/**
 * A folded vaccine name without what is written around the vaccine: a
 * parenthesised book name and the word for "vaccine". Only for matching;
 * nothing is stored this way.
 */
export function looseVaccineName(folded: string): string {
  return folded
    .replace(/\([^)]*\)/g, " ")
    .replace(/(^|\s)(asi|asisi|asilari|asilar|vaccine|vaccination|vaksin)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===========================================================================
// What an animal's own record says about where it is (#45)
// ===========================================================================

/** One vaccination row, as much of it as the summary needs. */
export interface DoseRow {
  name: string;
  administeredAt: Date;
  nextDueAt: Date | null;
  doseNumber: number | null;
  seriesOf: number | null;
}

/** Where an animal is in a starting series, as its own records state it. */
export interface SeriesProgress {
  key: string;
  name: string;
  /** From the record, never counted: see `seriesFrom` for why. */
  dose: number;
  of: number;
  nextDueAt: Date | null;
  overdue: boolean;
}

/** One calendar year of the vaccine somebody outside the clinic asks about. */
export interface OfficialYear {
  year: number;
  given: boolean;
}

/**
 * Which dose of a starting series this animal is on, per vaccine.
 *
 * READ FROM THE RECORD, NEVER COUNTED, and this is the rule the whole
 * function exists to keep. Counting an animal's rows for a vaccine would
 * be using TODAY's catalogue to characterise doses written before it
 * existed -- the same restating of history that `seriesOf` is stored to
 * prevent. It also gets the commonest case wrong in the most expensive
 * direction: a five-year-old dog with four annual boosters would read as
 * an unfinished puppy series, which is precisely the mistake the vet is
 * already making by hand and paying for ("emin olamayınca baştan
 * başlatıyorum, sahibi de boşuna para veriyor").
 *
 * So the line appears from the first dose recorded WITH a position, and
 * nothing is back-filled. An animal whose history predates this feature
 * shows no series line, which is true: nobody wrote down which dose it
 * was.
 *
 * A finished series is not progress and is left out entirely; from there
 * the adult schedule owns the animal.
 */
export function seriesFrom(
  offers: readonly VaccineOffer[],
  rows: readonly DoseRow[],
  now: Date = new Date(),
): SeriesProgress[] {
  const latest = new Map<string, DoseRow>();
  for (const row of rows) {
    if (row.doseNumber === null || row.seriesOf === null) continue;
    const offer = offerByName(offers, row.name);
    if (!offer?.series) continue;
    const held = latest.get(offer.key);
    // The most recent dose is the one that says where we are. Equal
    // timestamps keep the first seen; two doses of one vaccine at the
    // same instant is a data problem, not a question this can answer.
    if (!held || row.administeredAt > held.administeredAt) {
      latest.set(offer.key, row);
    }
  }

  const out: SeriesProgress[] = [];
  for (const offer of offers) {
    const row = latest.get(offer.key);
    if (!row || row.doseNumber === null || row.seriesOf === null) continue;
    if (row.doseNumber >= row.seriesOf) continue;
    out.push({
      key: offer.key,
      name: offer.name,
      dose: row.doseNumber,
      of: row.seriesOf,
      nextDueAt: row.nextDueAt,
      // Only ever claimed from a date the record carries. No date is not
      // "on time" and not "late" -- it is nobody having said when, and
      // the screen says that much and no more.
      overdue: row.nextDueAt !== null && row.nextDueAt < now,
    });
  }
  return out;
}

/**
 * The year-by-year pattern for the vaccine somebody outside the clinic
 * asks about, gaps included.
 *
 * The question this answers is not a date, it is a shape: "kuduz aşısı
 * geçen sene yapıldı mı, ondan önce de düzenli miydi" -- asked after a
 * bite, by someone who is not the vet. A list of records sorted by date
 * cannot be read that way; a run of years with holes in it can.
 *
 * From the first year on record to this one, so the holes are visible as
 * holes rather than as rows that are not there. Bounded by the animal's
 * life, which is why there is no cap: twenty entries is the worst case a
 * real animal can reach.
 *
 * `year` comes from the clinic's calendar, not the server's: a dose given
 * at 01:00 on 1 January in Istanbul belongs to the year the clinic was
 * standing in when it gave it.
 */
export function officialYearsFrom(
  offers: readonly VaccineOffer[],
  rows: readonly DoseRow[],
  yearOf: (date: Date) => number,
  thisYear: number,
): { name: string; years: OfficialYear[] } | null {
  const offer = offers.find((entry) => entry.official);
  if (!offer) return null;

  const given = new Set<number>();
  for (const row of rows) {
    if (offerByName(offers, row.name)?.key !== offer.key) continue;
    given.add(yearOf(row.administeredAt));
  }
  // No record at all is not a pattern with every year missing: it is an
  // animal this clinic has never given it to, and saying "2019 yok, 2020
  // yok..." about records that were never this clinic's would be an
  // accusation rather than an answer.
  if (given.size === 0) return null;

  const first = Math.min(...given);
  const years: OfficialYear[] = [];
  for (let year = first; year <= thisYear; year++) {
    years.push({ year, given: given.has(year) });
  }
  return { name: offer.name, years };
}
