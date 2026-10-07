import { fold } from "@/lib/search";
import { normalizePhone } from "@/lib/phone";
import { isBlank, looksLikeYear } from "./infer";
import type { ImportField } from "./fields";

/**
 * Turning answered columns into people and animals -- and refusing to
 * decide the one thing a spreadsheet cannot settle.
 *
 * Everything in this file is pure: rows in, a plan out, no database and no
 * clinic. That is not tidiness, it is what lets the plan be SHOWN before
 * anything is written. The vet sees "these 84 rows become 61 clients, 12
 * attach to clients you already have, and about these 3 I cannot tell" and
 * then decides -- which is #20's line, in the place it actually bites: the
 * product proposes, the vet rules.
 *
 * THE ONE RULE THAT SHAPES THE REST: TWO ROWS ARE THE SAME PERSON WHEN THE
 * NAME AND THE PHONE BOTH SAY SO, AND OTHERWISE WE ASK.
 *
 * A clinic's file has one row per animal, so a client with three animals is
 * three rows, and importing it row by row gives them three records. Merging
 * on the name alone is worse than not merging: "Ayse Yilmaz" is not rare,
 * and a wrong merge puts one family's animals into another family's file --
 * a mistake that undo can reverse and a vet reading it later cannot. So the
 * phone is what confirms a name, and a row with no phone produces a
 * QUESTION rather than a guess. There is no default answer to that
 * question, on purpose.
 */

/** Which field each column was sent to. Columns the vet skipped are absent. */
export type Mapping = Record<number, ImportField>;

/** How an ambiguous date column reads, per column. Unambiguous ones are absent. */
export type DateOrders = Record<number, "dayFirst" | "monthFirst">;

type ValueField = Exclude<ImportField, "skip">;

/** One row's cells, by the field the vet sent each column to. */
export type FieldValues = Partial<Record<ValueField, string>>;

/** Fields whose columns are joined rather than first-wins. */
const JOINED: ReadonlySet<ValueField> = new Set(["client.notes", "pet.notes"]);

/**
 * The first non-empty value wins when two columns were sent to the same
 * field. Nothing stops a vet from mapping two columns to `client.notes`,
 * and this is the only rule that does not lose data silently in one
 * direction: the earlier column is the one they answered first, and a blank
 * never overwrites something that was filled in.
 */
export function rowValues(cells: readonly string[], mapping: Mapping): FieldValues {
  const out: FieldValues = {};
  for (const [col, field] of Object.entries(mapping)) {
    // A vaccine column is read on its own in `vaccinationsOf`: there can be
    // several, and each is a record rather than a value.
    if (field === "skip" || field === "vaccine.column") continue;
    const value = (cells[Number(col)] ?? "").trim();
    if (value === "") continue;
    if (out[field] === undefined) out[field] = value;
    // Two note columns are two things the clinic wrote down. First-wins
    // would keep one and drop the other without a word.
    else if (JOINED.has(field) && !isBlank(value)) out[field] = `${out[field]} · ${value}`;
  }
  return out;
}

export type OwnerDraft = {
  firstName: string;
  lastName: string | null;
  /** As the vet typed it. The normalized form is only for comparing. */
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
};

export type PetDraft = {
  name: string;
  /**
   * The species column's raw text ("Kedi", "kedi ", "Tekir Kedi"). It stays
   * raw here because turning it into an enum is a decision the vet sees and
   * can change (`enum-map.ts`), and because a clinic-defined species is a
   * database write that a pure function may not make.
   */
  speciesRaw: string | null;
  breed: string | null;
  sexRaw: string | null;
  birthDate: Date | null;
  /**
   * The file gave a year alone and the vet chose to take it as 1 January
   * of that year. Written with the record so every screen can say
   * "tahmini" rather than state a birthday nobody gave.
   */
  birthDateEstimated: boolean;
  microchipId: string | null;
  color: string | null;
  weightKg: number | null;
  /** Null when the file says nothing, or says something we cannot read. */
  neutered: boolean | null;
  notes: string | null;
};

/** One vaccination a row will become. Dates are days, at UTC midnight. */
export type VaccinationDraft = {
  name: string;
  administeredAt: Date;
  /** From the file's own next-date column, or null. */
  nextDueAt: Date | null;
  /** The column the date came from, so the screen can point at it. */
  col: number;
};

/**
 * Something in a row that will not land where its column said, and where
 * it goes instead. Never a silent loss: each of these also writes the
 * cell, as the clinic typed it, into the animal's notes.
 */
export type RowWarning = {
  kind:
    /** Not a date in any order: "geçen eylül", "32.13.2020". */
    | "dateUnreadable"
    /** A year alone, "2021": kept in the notes, no birthday invented. */
    | "yearOnly"
    /** A vaccination dated after today. */
    | "dateInFuture"
    /** A vaccine name with no date beside it. */
    | "vaccineNoDate"
    /** A vaccine date with no name beside it. */
    | "vaccineNoName";
  field: ValueField;
  col: number;
  raw: string;
  vaccine?: string;
};

/** What the plan needs besides the mapping, all of it the vet's answers. */
export type PlanOptions = {
  /** Per `vaccine.column`: the vaccine its dates are doses of. */
  vaccineNames?: Record<number, string>;
  /**
   * Per column, the words a note uses to say where a kept value came from:
   * the vet's own heading, or the field's name when there is none.
   */
  columnLabels?: Record<number, string>;
  /** "Today" for the future-date check. A parameter so tests can pin it. */
  today?: Date;
  /**
   * The word a kept vaccine note uses before the file's own next date:
   * "Lyme: 26.10.2026 (sonraki: 26.10.2027)". In the reader's language.
   */
  nextWord?: string;
  /**
   * The vet's one answer to "these future dates may be planned doses --
   * take them as the next dose?". Yes moves a future date onto the
   * latest earlier dose of the same vaccine in the same row, as that
   * dose's next date. A future date with no earlier dose to hang on
   * stays in the notes either way: there is no record to attach it to.
   */
  futureAsNextDue?: boolean;
  /** "A year alone: take it as 1 January, marked estimated?" Yes when true. */
  estimateBirthYear?: boolean;
};

/**
 * Why `deceased` is not in `PetDraft` and must not be added to it.
 *
 * A file of a clinic's animals says nothing about which of them are alive;
 * it is a list of records, and some of those animals died years ago. The
 * column has a default of `false`, so importing writes "alive" for every
 * row -- an assertion nobody made, about the case where being wrong is
 * worst. Leaving the field unwritten records the same absence the vet
 * actually has.
 */

export type RowIssue =
  /** Nothing in the row after mapping. Not an error -- a blank line. */
  | "blank"
  /** No name for the person, so there is nobody to create. */
  | "noOwnerName"
  /** A person but no animal name. The client is created, the animal is not. */
  | "noPetName";

const YES = new Set(["evet", "e", "var", "yes", "y", "true", "1", "x", "kisir", "kisirlastirildi", "kastre"]);
const NO = new Set(["hayir", "h", "no", "n", "false", "0"]);

function parseYesNo(raw: string): boolean | null {
  const v = fold(raw.trim());
  if (YES.has(v)) return true;
  if (NO.has(v)) return false;
  return null;
}

export type PlanRow = {
  /** 1-based, counted over body rows, so it matches what the vet scrolls past. */
  index: number;
  owner: OwnerDraft | null;
  pet: PetDraft | null;
  /** Name and phone together, or null when the row makes nobody. */
  ownerKey: string | null;
  issue?: RowIssue;
  /** What this row's animal has had, read off the vaccine columns. */
  vaccinations: VaccinationDraft[];
  warnings: RowWarning[];
  /**
   * Vaccinations dated after today, counted by whether the row also has an
   * earlier dose of the same vaccine for them to be the next date of. The
   * file-level question is asked from these counts.
   */
  future?: { anchored: number; unanchored: number };
  /** The birth date cell held a year alone. */
  birthYearOnly?: boolean;
};

/** A client this clinic already has, as much of one as dedup needs. */
export type ExistingClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  /**
   * Their animals, by name, when the caller read them. Lets a re-import
   * recognise "Hasan Öztürk, no phone, with Paşa" as the Hasan Öztürk who
   * already has a Paşa, instead of asking about him every time.
   */
  pets?: ReadonlyArray<{ id: string; name: string }>;
};

/**
 * One person, as far as the file can tell: the rows that are certainly
 * them, and the question if there is one.
 */
export type OwnerGroup = {
  key: string;
  /** The fullest version of them across their rows (first non-empty wins). */
  owner: OwnerDraft;
  rowIndexes: number[];
  /**
   * An existing client this group is certainly the same person as, matched
   * on name AND phone. Their animals attach to that record and no client is
   * created -- which is also why the existing client is never tagged with
   * the batch: undo may delete what the import made, never what it found.
   */
  matchedClientId?: string;
  /**
   * Same name, no phone to confirm it. Unanswered by design; the screen
   * blocks on these the way it blocks on an unmapped column.
   */
  possible?: PossibleMatch[];
};

export type PossibleMatch =
  | { kind: "existing"; id: string; name: string; phone: string | null }
  | { kind: "group"; key: string; name: string; phone: string | null };

/** What the vet answered for one "possibly the same person" question. */
export type DuplicateAnswer =
  | { kind: "separate" }
  | { kind: "existing"; id: string }
  | { kind: "group"; key: string };

export type ImportPlan = {
  rows: PlanRow[];
  groups: OwnerGroup[];
  /** Rows that make nobody, with the reason, for the sentence on screen. */
  skipped: { index: number; issue: RowIssue }[];
  /** Rows that make a person but no animal. */
  clientOnly: number[];
};

/**
 * Between the name and the phone in a group key. A character no name
 * contains, so "Ali Veli" with no phone cannot collide with a name that
 * happens to end in whatever separator a reasonable person would pick.
 */
const NAME_KEY_SEPARATOR = "\u0000";

/** Folded full name plus normalized phone. Empty phone means "not confirmable". */
function ownerIdentity(firstName: string, lastName: string | null, phone: string | null) {
  const name = fold([firstName, lastName ?? ""].join(" ").trim());
  const dialled = normalizePhone(phone);
  return { name, dialled, key: `${name}${NAME_KEY_SEPARATOR}${dialled ?? ""}` };
}

function parseWeight(raw: string): number | null {
  // "12,5" is how a Turkish keyboard writes it, and `Number("12,5")` is NaN.
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const DATE_PARTS = /^(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})$/;

/**
 * A date, or null when the text is not one.
 *
 * `order` is only consulted when the value itself is ambiguous. An ISO date
 * (which is what `read-workbook` writes a real Excel date out as) and any
 * value whose first part cannot be a month read themselves, and a vet's
 * answer about the column must not be able to turn 25.12 into a month.
 *
 * Built in UTC so the same cell does not become a different day depending on
 * where the server is standing. A birth date is a date, not an instant.
 */
export function parseDate(raw: string, order?: "dayFirst" | "monthFirst"): Date | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const parts = DATE_PARTS.exec(value);
  if (!parts) return null;
  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const third = Number(parts[3]);
  // A four-digit leading part is a year, whatever the column's answer says.
  if (parts[1].length === 4) return makeDate(first, second, third);

  const year = third < 100 ? (third > 50 ? 1900 + third : 2000 + third) : third;
  // The value decides where it can; the vet's answer only breaks a tie.
  const dayFirst = first > 12 ? true : second > 12 ? false : order !== "monthFirst";
  return dayFirst ? makeDate(year, second, first) : makeDate(year, first, second);
}

function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rolls over on 31 February, which is a typo rather than a date.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function firstNonEmpty(values: (string | null)[]): string | null {
  for (const value of values) if (value !== null && value.trim() !== "") return value.trim();
  return null;
}

/**
 * One field's value, or null when the cell says nothing.
 *
 * "Nothing" is `isBlank`'s definition, not just the empty string: a clinic
 * writes "-", "yok" or "bilinmiyor" where a value is missing, and taking
 * those literally would produce a client whose surname is a dash and a
 * microchip number reading "bilinmiyor". The import screen already reads
 * them as blanks when it classifies a column; writing would disagree with
 * the screen the vet answered on.
 */
function text(values: FieldValues, field: ValueField): string | null {
  const value = values[field];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" || isBlank(trimmed) ? null : trimmed;
}

/** One sheet row, read through the vet's answers. */
export function planRow(
  cells: readonly string[],
  mapping: Mapping,
  dateOrders: DateOrders,
  index: number,
  options: PlanOptions = {},
): PlanRow {
  const values = rowValues(cells, mapping);
  const vaccineColumns = Object.entries(mapping)
    .filter(([, f]) => f === "vaccine.column")
    .map(([col]) => Number(col));
  const anyVaccineCell = vaccineColumns.some((col) => (cells[col] ?? "").trim() !== "");
  if (Object.keys(values).length === 0 && !anyVaccineCell) {
    return { index, owner: null, pet: null, ownerKey: null, issue: "blank", vaccinations: [], warnings: [] };
  }

  const firstName = text(values, "client.firstName");
  if (!firstName) {
    // Deliberately not "put the animal under a placeholder owner". An animal
    // with no person attached is a record nobody can act on: it cannot be
    // called, reminded or billed, and the vet would meet it as a mystery
    // months later. Reported instead, with its row number.
    return { index, owner: null, pet: null, ownerKey: null, issue: "noOwnerName", vaccinations: [], warnings: [] };
  }

  const lastName = text(values, "client.lastName");
  const phone = text(values, "client.phone");
  const owner: OwnerDraft = {
    firstName,
    lastName,
    phone,
    secondaryPhone: text(values, "client.secondaryPhone"),
    email: text(values, "client.email"),
    city: text(values, "client.city"),
    address: text(values, "client.address"),
    notes: text(values, "client.notes"),
  };

  const columnOf = (field: ValueField) => {
    const found = Object.entries(mapping).find(([, f]) => f === field)?.[0];
    return found === undefined ? undefined : Number(found);
  };
  const label = (col: number) => options.columnLabels?.[col] ?? `#${col + 1}`;
  const today = options.today ?? new Date();
  const warnings: RowWarning[] = [];
  // What could not be put where its column said, kept in the clinic's own
  // words. A value that has nowhere to go goes HERE rather than nowhere.
  const kept: string[] = [];

  let birthYearOnly = false;
  let birthDateEstimated = false;
  const readDate = (field: ValueField, col: number | undefined, raw: string | null) => {
    if (raw === null || col === undefined) return null;
    const date = parseDate(raw, dateOrders[col]);
    if (date) return date;
    const yearOnly = looksLikeYear(raw);
    if (yearOnly && field === "pet.birthDate") {
      birthYearOnly = true;
      if (options.estimateBirthYear) {
        // The vet's answer, and the record says it is an estimate. No note:
        // the year is in the date, and the flag says the rest.
        birthDateEstimated = true;
        return makeDate(Number(raw.trim()), 1, 1);
      }
    }
    warnings.push({ kind: yearOnly ? "yearOnly" : "dateUnreadable", field, col, raw });
    kept.push(`${label(col)}: ${raw}`);
    return null;
  };

  const petName = text(values, "pet.name");
  const birthColumn = columnOf("pet.birthDate");
  const birthRaw = text(values, "pet.birthDate");
  const weightRaw = text(values, "pet.weightKg");
  const neuteredRaw = text(values, "pet.neutered");

  const birthDate = petName ? readDate("pet.birthDate", birthColumn, birthRaw) : null;
  const future = { anchored: 0, unanchored: 0 };
  const vaccinations = petName
    ? vaccinationsOf(cells, values, mapping, dateOrders, vaccineColumns, options, today, label, warnings, kept, future)
    : [];

  const notes = [text(values, "pet.notes"), ...kept].filter((n): n is string => !!n);
  const pet: PetDraft | null = petName
    ? {
        name: petName,
        speciesRaw: text(values, "pet.species"),
        breed: text(values, "pet.breed"),
        sexRaw: text(values, "pet.sex"),
        birthDate,
        birthDateEstimated,
        microchipId: text(values, "pet.microchipId"),
        color: text(values, "pet.color"),
        weightKg: weightRaw ? parseWeight(weightRaw) : null,
        neutered: neuteredRaw ? parseYesNo(neuteredRaw) : null,
        notes: notes.length > 0 ? notes.join("\n") : null,
      }
    : null;

  return {
    index,
    owner,
    pet,
    ownerKey: ownerIdentity(firstName, lastName, phone).key,
    issue: pet ? undefined : "noPetName",
    vaccinations,
    warnings,
    ...(future.anchored + future.unanchored > 0 ? { future } : {}),
    ...(birthYearOnly ? { birthYearOnly } : {}),
  };
}

/**
 * The row's vaccinations: one per filled vaccine column, plus one from the
 * name-and-date pair when the file is written that way.
 *
 * NOTHING HERE IS DROPPED QUIETLY, and that is the vet's condition for
 * switching: "kuduz tarihi sessizce kaybolmamalı". A date that does not
 * read, a date in the future, a name with no date -- each becomes a
 * warning the screen shows and a line in the animal's notes, in the
 * clinic's own words, so the fact survives even when the record cannot.
 */
function vaccinationsOf(
  cells: readonly string[],
  values: FieldValues,
  mapping: Mapping,
  dateOrders: DateOrders,
  vaccineColumns: number[],
  options: PlanOptions,
  today: Date,
  label: (col: number) => string,
  warnings: RowWarning[],
  kept: string[],
  futureCount: { anchored: number; unanchored: number },
): VaccinationDraft[] {
  const out: VaccinationDraft[] = [];
  const columnOf = (field: ValueField) => {
    const found = Object.entries(mapping).find(([, f]) => f === field)?.[0];
    return found === undefined ? undefined : Number(found);
  };
  const nextWord = options.nextWord ?? "sonraki";
  // A kept vaccine note names the vaccine and carries the file's next
  // date, so "Lyme: 26.10.2026 (sonraki: 26.10.2027)" survives whole
  // instead of "Aşı Tarihi: 26.10.2026" with the vaccine and the next dose
  // gone (A3).
  const note = (name: string, raw: string, nextRaw: string | null) =>
    `${name}: ${showDate(raw)}${nextRaw ? ` (${nextWord}: ${showDate(nextRaw)})` : ""}`;

  // Future-dated doses wait until every past dose of the row is known, so
  // one can be matched to the latest earlier dose of its vaccine.
  const future: Array<{ name: string; date: Date; raw: string; nextRaw: string | null; col: number; field: ValueField }> = [];

  const dated = (
    name: string,
    col: number,
    raw: string,
    nextDueAt: Date | null,
    field: ValueField,
    nextRaw: string | null,
  ) => {
    const date = parseDate(raw, dateOrders[col]);
    if (!date) {
      warnings.push({ kind: looksLikeYear(raw) ? "yearOnly" : "dateUnreadable", field, col, raw, vaccine: name });
      kept.push(note(name, raw, nextRaw));
      return;
    }
    if (date.getTime() > today.getTime()) {
      future.push({ name, date, raw, nextRaw, col, field });
      return;
    }
    out.push({ name, administeredAt: date, nextDueAt, col });
  };

  for (const col of vaccineColumns) {
    const raw = (cells[col] ?? "").trim();
    if (raw === "" || isBlank(raw)) continue;
    const name = options.vaccineNames?.[col]?.trim() || label(col);
    dated(name, col, raw, null, "vaccine.column", null);
  }

  const name = text(values, "vaccine.name");
  const dateCol = columnOf("vaccine.date");
  const nextCol = columnOf("vaccine.nextDue");
  const dateRaw = text(values, "vaccine.date");
  const nextRaw = text(values, "vaccine.nextDue");
  const next = nextRaw && nextCol !== undefined ? parseDate(nextRaw, dateOrders[nextCol]) : null;
  if (nextRaw && !next && nextCol !== undefined) {
    warnings.push({ kind: "dateUnreadable", field: "vaccine.nextDue", col: nextCol, raw: nextRaw, vaccine: name ?? undefined });
    kept.push(name ? `${name}: ${label(nextCol)}: ${nextRaw}` : `${label(nextCol)}: ${nextRaw}`);
  }
  if (name && dateRaw && dateCol !== undefined) {
    dated(name, dateCol, dateRaw, next, "vaccine.date", next ? nextRaw : null);
  } else if (name) {
    const nameCol = columnOf("vaccine.name") as number;
    warnings.push({ kind: "vaccineNoDate", field: "vaccine.name", col: nameCol, raw: name, vaccine: name });
    kept.push(`${label(nameCol)}: ${name}${next && nextRaw ? ` (${label(nextCol as number)}: ${nextRaw})` : ""}`);
  } else if (dateRaw && dateCol !== undefined) {
    warnings.push({ kind: "vaccineNoName", field: "vaccine.date", col: dateCol, raw: dateRaw });
    kept.push(`${label(dateCol)}: ${dateRaw}`);
  }

  const taken = new Set<VaccinationDraft>();
  for (const entry of future) {
    const key = fold(entry.name.trim());
    let anchor: VaccinationDraft | null = null;
    for (const dose of out) {
      if (fold(dose.name.trim()) !== key || dose.administeredAt >= entry.date) continue;
      if (!anchor || dose.administeredAt > anchor.administeredAt) anchor = dose;
    }
    // Only a dose with no next date of its own takes this one: a date the
    // file already gave is the file's word and is not overwritten.
    const usable = anchor && !anchor.nextDueAt && !taken.has(anchor) ? anchor : null;
    if (usable) {
      taken.add(usable);
      futureCount.anchored += 1;
    } else {
      futureCount.unanchored += 1;
    }
    if (usable && options.futureAsNextDue) {
      usable.nextDueAt = entry.date;
      continue;
    }
    warnings.push({ kind: "dateInFuture", field: entry.field, col: entry.col, raw: entry.raw, vaccine: entry.name });
    kept.push(note(entry.name, entry.raw, entry.nextRaw));
  }
  return out;
}

/** A real Excel date travels as ISO; a note shows it the way Excel showed it. */
function showDate(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.split("-").reverse().join(".") : raw;
}

/**
 * The whole plan: every row read, grouped into people, matched against the
 * clinic where the evidence allows it and questioned where it does not.
 *
 * `existing` is every non-archived client of the clinic, read once. That is
 * one query and one pass rather than a lookup per row, which is the
 * difference between an import that grows with the file and one that grows
 * with the file TIMES the clinic.
 */
export function buildPlan(
  bodyRows: readonly (readonly string[])[],
  mapping: Mapping,
  dateOrders: DateOrders,
  existing: readonly ExistingClient[],
  options: PlanOptions = {},
): ImportPlan {
  const rows = bodyRows.map((cells, i) => planRow(cells, mapping, dateOrders, i + 1, options));
  const petNamesOf = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.ownerKey || !row.pet) continue;
    const set = petNamesOf.get(row.ownerKey) ?? new Set<string>();
    set.add(fold(row.pet.name));
    petNamesOf.set(row.ownerKey, set);
  }

  const byKey = new Map<string, OwnerGroup>();
  for (const row of rows) {
    if (!row.owner || !row.ownerKey) continue;
    const found = byKey.get(row.ownerKey);
    if (!found) {
      byKey.set(row.ownerKey, {
        key: row.ownerKey,
        owner: { ...row.owner },
        rowIndexes: [row.index],
      });
      continue;
    }
    found.rowIndexes.push(row.index);
    // The fullest version of them: a second row often carries the address
    // the first one left blank, and dropping it would lose data the file
    // has for no reason other than row order.
    found.owner = {
      firstName: found.owner.firstName,
      lastName: firstNonEmpty([found.owner.lastName, row.owner.lastName]),
      phone: firstNonEmpty([found.owner.phone, row.owner.phone]),
      secondaryPhone: firstNonEmpty([found.owner.secondaryPhone, row.owner.secondaryPhone]),
      email: firstNonEmpty([found.owner.email, row.owner.email]),
      city: firstNonEmpty([found.owner.city, row.owner.city]),
      address: firstNonEmpty([found.owner.address, row.owner.address]),
      notes: firstNonEmpty([found.owner.notes, row.owner.notes]),
    };
  }

  const groups = [...byKey.values()];

  // Existing clients indexed by folded name once, so matching is a lookup
  // per group rather than a scan of the clinic per group.
  const existingByName = new Map<string, ExistingClient[]>();
  for (const client of existing) {
    const { name } = ownerIdentity(client.firstName, client.lastName, null);
    const list = existingByName.get(name);
    if (list) list.push(client);
    else existingByName.set(name, [client]);
  }

  const groupsByName = new Map<string, OwnerGroup[]>();
  for (const group of groups) {
    const name = group.key.split(NAME_KEY_SEPARATOR)[0] ?? "";
    const list = groupsByName.get(name);
    if (list) list.push(group);
    else groupsByName.set(name, [group]);
  }

  for (const group of groups) {
    const [name, dialled] = group.key.split(NAME_KEY_SEPARATOR);
    const sameName = existingByName.get(name ?? "") ?? [];

    if (dialled) {
      // The phone is checked against both of theirs: a clinic's file often
      // holds the number the client actually answers, which may be the one
      // recorded second. Matching only the primary would create a duplicate
      // of somebody the clinic can already call.
      const match = sameName.find(
        (c) =>
          normalizePhone(c.phone) === dialled ||
          normalizePhone(c.secondaryPhone) === dialled,
      );
      if (match) {
        group.matchedClientId = match.id;
        continue;
      }
    }

    // The same person by a second, independent fact: a client of this name
    // who already has an animal of this name. "Hasan Öztürk with Paşa" is
    // not a coincidence two people share, and it is exactly what a clinic
    // re-importing its own file looks like for the owners with no number.
    // ONE such client, or it is still a question.
    const ownPets = petNamesOf.get(group.key);
    if (ownPets && ownPets.size > 0) {
      const byAnimal = sameName.filter((c) =>
        (c.pets ?? []).some((p) => ownPets.has(fold(p.name))),
      );
      if (byAnimal.length === 1) {
        group.matchedClientId = byAnimal[0].id;
        continue;
      }
    }

    // No confirmed match. Anybody sharing the name is a question, never an
    // answer -- including a name-mate inside the file itself, which is how
    // the same person typed once with and once without their number looks
    // from here.
    //
    // EXCEPT where both sides have a number and the numbers differ. That is
    // not missing evidence, it is evidence against: two "Ayşe Yılmaz" on
    // two different phones are, in a Turkish clinic's list, two people far
    // more often than one, and asking about every such pair turned a
    // 4,821-row file into 3,199 questions nobody could answer. The
    // question stays where it belongs -- one side has no number to check.
    const disagrees = (phones: Array<string | null>) =>
      Boolean(dialled) &&
      phones.some((p) => normalizePhone(p) !== null) &&
      !phones.some((p) => normalizePhone(p) === dialled);
    const possible: PossibleMatch[] = [
      ...phoneMates(group, dialled, groups, existing),
      ...sameName
        .filter((c) => !disagrees([c.phone, c.secondaryPhone]))
        .map<PossibleMatch>((c) => ({
          kind: "existing",
          id: c.id,
          name: [c.firstName, c.lastName ?? ""].join(" ").trim(),
          phone: c.phone,
        })),
      ...(groupsByName.get(name ?? "") ?? [])
        .filter((other) => other.key !== group.key)
        .filter((other) => !disagrees([other.owner.phone]))
        .map<PossibleMatch>((other) => ({
          kind: "group",
          key: other.key,
          name: [other.owner.firstName, other.owner.lastName ?? ""].join(" ").trim(),
          phone: other.owner.phone,
        })),
    ];
    if (possible.length > 0) group.possible = possible;
  }

  return {
    rows,
    groups,
    skipped: rows
      .filter((r) => r.issue === "blank" || r.issue === "noOwnerName")
      .map((r) => ({ index: r.index, issue: r.issue as RowIssue })),
    clientOnly: rows.filter((r) => r.issue === "noPetName").map((r) => r.index),
  };
}

/**
 * The other reading of the same person: one number, one name written short
 * and once written in full.
 *
 * "Ada" and "Ada Kaya" on the same phone are almost certainly one client
 * recorded twice, and the name-and-phone key cannot see it because the
 * names differ. Asked rather than merged, like every other case where the
 * evidence is short of proof.
 *
 * NARROW ON PURPOSE: a shared number alone is not a question. A household
 * has one landline and three people on it, and turning every family in the
 * file into a duplicate question would teach the vet to click through the
 * questions that matter. Only a name that CONTAINS the other as its
 * opening words qualifies.
 */
function phoneMates(
  group: OwnerGroup,
  dialled: string | undefined,
  groups: readonly OwnerGroup[],
  existing: readonly ExistingClient[],
): PossibleMatch[] {
  if (!dialled) return [];
  const own = fold([group.owner.firstName, group.owner.lastName ?? ""].join(" ").trim());

  const out: PossibleMatch[] = [];
  for (const client of existing) {
    if (normalizePhone(client.phone) !== dialled && normalizePhone(client.secondaryPhone) !== dialled)
      continue;
    const name = [client.firstName, client.lastName ?? ""].join(" ").trim();
    if (!sharesNameStem(own, fold(name))) continue;
    out.push({ kind: "existing", id: client.id, name, phone: client.phone });
  }
  for (const other of groups) {
    if (other.key === group.key) continue;
    const [otherName, otherDialled] = other.key.split(NAME_KEY_SEPARATOR);
    if (otherDialled !== dialled) continue;
    if (!sharesNameStem(own, otherName ?? "")) continue;
    out.push({
      kind: "group",
      key: other.key,
      name: [other.owner.firstName, other.owner.lastName ?? ""].join(" ").trim(),
      phone: other.owner.phone,
    });
  }
  return out;
}

/** One folded name opens the other, on a word boundary. */
function sharesNameStem(a: string, b: string): boolean {
  if (a === b) return false;
  return a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

/** The questions that must be answered before anything may be written. */
export function openQuestions(
  plan: ImportPlan,
  answers: Record<string, DuplicateAnswer>,
): string[] {
  return plan.groups
    .filter((g) => g.possible && g.possible.length > 0 && !answers[g.key])
    .map((g) => g.key);
}
