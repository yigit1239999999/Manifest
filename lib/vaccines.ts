import { fold } from "@/lib/search";

/**
 * The list the product ships with, in the words the vet actually uses.
 *
 * WHERE EVERY NUMBER IN THIS FILE COMES FROM. A practising vet, 23 September
 * 2026, asked vaccine by vaccine, with "sure" and "not sure" recorded
 * separately. Nothing here is from a textbook and nothing here is inferred
 * from another line. Where they said they did not know, the entry says so
 * (see `adult: { kind: "ask" }`) rather than carrying a number nobody gave.
 *
 * THE NAME IS THE ONE IN THEIR MOUTH. "Sahibine karma diyorum, kimse DHPP
 * demiyor, ben de demiyorum." So the name is `Karma` and `DHPPi` is a note
 * beside it. The old catalogue did the opposite -- `Karma - Parvo, Gençlik,
 * Hepatit, Parainfluenza (DHPPi)` -- which is the book's row with the vet's
 * word buried at the front of it.
 *
 * AND THAT RENAME IS WHY `aliases` EXISTS. Suggestions from a clinic's own
 * history are keyed on the vaccine's NAME (`vaccinationIntervalSuggestions`),
 * so a clinic that has been writing the long name for a year would look, the
 * day this list lands, like a clinic with no history at all -- their own
 * measured interval silently replaced by ours. Every name this product has
 * ever offered is in `aliases`, folded, and that is a permanent obligation:
 * renaming an entry without leaving its old name here disconnects every
 * record already written under it.
 *
 * DOG AND CAT ONLY. The vet was asked about birds, rabbits and rodents and
 * said: "Bizde o aşı bulunmuyor ve ben hiç yazmadım. Listeye koymayın,
 * boşuna yer kaplar." Horses and farm animals were not discussed at all, so
 * they are absent for the stronger reason: nobody has said anything about
 * them. The species list and the vaccine list are different things, and an
 * animal with no entries here is not unsupported -- the vaccine name is free
 * text and always was.
 */

/** A span of weeks the vet gave as a range. Never averaged into one number. */
export interface WeekRange {
  min: number;
  /** Absent when the vet gave a single figure ("8 hafta") rather than a span. */
  max?: number;
}

/**
 * The starting series: more than one dose, weeks apart, before the animal is
 * on a yearly schedule at all.
 *
 * This is the shape a single `nextDueAt` cannot hold, and the reason is the
 * vet's most expensive problem in their own words: "Karma üç doz, sahibi
 * ikinci dozdan sonra kayboluyor, üç ay sonra geliyor. O an sorduğum şey 'en
 * son ne zaman' değil, 'kaçıncı dozdaydık'. Emin olamayınca baştan
 * başlatıyorum, sahibi de boşuna para veriyor." A schedule that only knows
 * the last date cannot answer the question that costs the owner money.
 */
export interface VaccineSeries {
  /** How many doses the starting series has, counting the first. */
  doses: number;
  /** The gap between one dose and the next. */
  between: WeekRange;
  /**
   * An age the LAST dose may not come before, in weeks, where the vet named
   * one. Not arithmetic: the series can be finished later than the gaps
   * suggest, and it may not be finished earlier than this.
   */
  lastNotBeforeWeeks?: number;
}

/**
 * What happens once the animal is grown, or the admission that we do not
 * know.
 *
 * `ask` is a real member of this union rather than an absence, and that is
 * the product refusing to decide (#20, and TEAM.md #14). The vet about
 * kennel cough: "burun içi olanı yılda bir yapıyorum ama altı ay diyenler de
 * var, ben karar veremiyorum. Bunun tarihini önermeyin, bana sorun." So the
 * vaccine IS on the list -- they give it -- and the screen asks for the date
 * instead of proposing one. A row with no interval is the design, not a gap
 * in it.
 */
export type AdultSchedule =
  | { kind: "every"; unit: "week" | "month" | "year"; value: number }
  | { kind: "ask" };

/** A note that belongs to the vaccine, rendered from the catalogue by key. */
export type VaccineNote =
  /** Comes inside the combination vaccine rather than as its own injection. */
  | "insideCombination"
  /** A test comes first, and the schedule only applies if it is negative. */
  | "testFirst"
  /** Given by choice after talking to the owner, not to every animal. */
  | "byAgreement";

export interface Vaccine {
  /** Stable across renames. Nothing user-facing, and nothing in the database. */
  key: string;
  species: "DOG" | "CAT";
  /** The vet's word. This is the name, not a label for another name. */
  name: string;
  /** The book's name, shown beside it. A note, never the name. */
  bookName?: string;
  /** Every name this vaccine has been offered under, for matching history. */
  aliases: readonly string[];
  /** The earliest age it is given at, where the vet named one. */
  startAt?: WeekRange;
  series?: VaccineSeries;
  adult: AdultSchedule;
  note?: VaccineNote;
  /**
   * Somebody outside this clinic asks about this one.
   *
   * The vet's second use for history, in their words: "Köpek birini
   * ısırdı, ve o an 'kuduz aşısı geçen sene yapıldı mı, ondan önce de
   * düzenli miydi' sorusu soruluyor, ve bu artık benim değil resmî bir
   * soru." A screen that has to answer that needs to know WHICH vaccine
   * is asked about, and marking it here keeps the answer with the
   * vaccine rather than putting a catalogue key in a component (#45).
   *
   * A clinic's own added vaccines cannot carry this, which is correct:
   * nobody outside the clinic asks about a vaccine only that clinic
   * offers.
   */
  official?: true;
}

export const VACCINE_CATALOGUE: readonly Vaccine[] = [
  {
    key: "dog.core",
    species: "DOG",
    name: "Karma",
    bookName: "DHPPi",
    aliases: [
      "Karma - Parvo, Gençlik, Hepatit, Parainfluenza (DHPPi)",
      "Karma + Leptospiroz (DHPPi+L)",
      "DHPP",
      "DHPPi",
    ],
    // "6-8 haftada ilk doz, 3-4 hafta arayla iki tekrar, son doz 16 haftadan
    // önce değil." Sure: "her hafta yapıyorum."
    startAt: { min: 6, max: 8 },
    series: { doses: 3, between: { min: 3, max: 4 }, lastNotBeforeWeeks: 16 },
    adult: { kind: "every", unit: "year", value: 1 },
  },
  {
    key: "dog.rabies",
    species: "DOG",
    name: "Kuduz",
    bookName: "Rabies",
    aliases: ["Kuduz (Rabies)", "Rabies"],
    // "12 haftadan sonra ilk doz", then yearly. Sure.
    startAt: { min: 12 },
    adult: { kind: "every", unit: "year", value: 1 },
    official: true,
  },
  {
    key: "dog.lepto",
    species: "DOG",
    name: "Leptospiroz",
    aliases: ["Leptospiroz", "Lepto"],
    // Yearly, and sure of that. NOT given a six-month schedule even though
    // the vet mentioned one exists: "riskli bölgede 6 ayda bir yapanlar var,
    // o şemayı koymayın." A practice they named without endorsing is not
    // evidence, and putting it here would make it the product's claim.
    adult: { kind: "every", unit: "year", value: 1 },
    note: "insideCombination",
  },
  {
    key: "dog.kennelCough",
    species: "DOG",
    name: "Köpek öksürüğü",
    bookName: "Kennel cough",
    aliases: ["Bronchiseptica / Köpek öksürüğü (Kennel cough)", "Bronchiseptica"],
    // The one they would not answer. On the list because they give it; no
    // date proposed because they said not to propose one.
    adult: { kind: "ask" },
  },
  {
    key: "cat.core",
    species: "CAT",
    name: "Karma",
    bookName: "FVRCP",
    aliases: [
      "Kedi karma - Panlökopeni, Rinotrakeit, Kalisi (FVRCP)",
      "Kedi karma + Klamidya (FVRCP+C)",
      "FVRCP",
    ],
    // "8 haftada ilk, 3-4 hafta arayla iki tekrar", then yearly. Sure.
    // A single figure rather than a range, so `max` is absent: they said
    // eight weeks, not six to eight, and widening it would be our invention.
    startAt: { min: 8 },
    series: { doses: 3, between: { min: 3, max: 4 } },
    adult: { kind: "every", unit: "year", value: 1 },
  },
  {
    key: "cat.rabies",
    species: "CAT",
    name: "Kuduz",
    bookName: "Rabies",
    aliases: ["Kuduz (Rabies)", "Rabies"],
    startAt: { min: 12 },
    adult: { kind: "every", unit: "year", value: 1 },
    official: true,
  },
  {
    key: "cat.felv",
    species: "CAT",
    name: "Lösemi",
    bookName: "FeLV",
    aliases: ["Kedi lösemisi (FeLV)", "FeLV"],
    // "Önce TEST; negatifse ilk yıl iki doz, 3-4 hafta arayla", then yearly.
    // The test is not a step of the series -- it decides whether the series
    // happens at all -- so it is a note rather than a dose.
    series: { doses: 2, between: { min: 3, max: 4 } },
    adult: { kind: "every", unit: "year", value: 1 },
    note: "testFirst",
  },
];

/**
 * The catalogue for one animal, in the order the vet listed them.
 *
 * Species other than dog and cat get an empty list, and that is an answer:
 * the vaccine field is free text, so an empty catalogue costs a vet nothing
 * but a proposal they never had.
 */
export function vaccinesForSpecies(species: string): readonly Vaccine[] {
  return VACCINE_CATALOGUE.filter((vaccine) => vaccine.species === species);
}

/**
 * Every name that means this vaccine, folded, including the current one.
 *
 * Folded with `lib/search.ts` so "karma", "Karma" and "KARMA" are one key --
 * the same folding the database and the history suggestion use, because a
 * second definition of "the same name" is how a clinic's history quietly
 * stops matching its own catalogue.
 */
export function vaccineKeys(vaccine: Vaccine): string[] {
  return [...new Set([vaccine.name, ...vaccine.aliases].map((n) => fold(n.trim())))];
}

/**
 * The catalogue entry a written name belongs to, or null.
 *
 * Used to connect a clinic's existing records to the list: a row written as
 * "Karma - Parvo, Gençlik, Hepatit, Parainfluenza (DHPPi)" last year and one
 * written as "Karma" today are the same vaccine, and the interval the clinic
 * measured for the first has to reach the second.
 *
 * Species-scoped, because "Karma" means two different vaccines and "Kuduz"
 * means the same one twice: without the species this lookup would have to
 * pick one, and picking would attach a cat's history to a dog's entry.
 */
export function vaccineByName(species: string, name: string): Vaccine | null {
  const wanted = fold(name.trim());
  if (wanted === "") return null;
  for (const vaccine of vaccinesForSpecies(species)) {
    if (vaccineKeys(vaccine).includes(wanted)) return vaccine;
  }
  return null;
}

/**
 * How many doses a series still owes after `given` of them, or null when
 * there is no series to speak of.
 *
 * Deliberately not a date. Which day the next dose lands on depends on the
 * day the last one was given, which this file does not know; what it knows
 * is how many are left, which is the question the vet said they actually ask
 * ("kaçıncı dozdaydık").
 */
export function dosesRemaining(vaccine: Vaccine, given: number): number | null {
  if (!vaccine.series) return null;
  return Math.max(0, vaccine.series.doses - given);
}
