import { fold } from "@/lib/search";
import { normalizePhone } from "@/lib/phone";
import { isBlank } from "./infer";
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
    if (field === "skip") continue;
    const value = (cells[Number(col)] ?? "").trim();
    if (value === "") continue;
    if (out[field] === undefined) out[field] = value;
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
  microchipId: string | null;
  color: string | null;
  weightKg: number | null;
  notes: string | null;
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

export type PlanRow = {
  /** 1-based, counted over body rows, so it matches what the vet scrolls past. */
  index: number;
  owner: OwnerDraft | null;
  pet: PetDraft | null;
  /** Name and phone together, or null when the row makes nobody. */
  ownerKey: string | null;
  issue?: RowIssue;
};

/** A client this clinic already has, as much of one as dedup needs. */
export type ExistingClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  secondaryPhone: string | null;
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
): PlanRow {
  const values = rowValues(cells, mapping);
  if (Object.keys(values).length === 0) {
    return { index, owner: null, pet: null, ownerKey: null, issue: "blank" };
  }

  const firstName = text(values, "client.firstName");
  if (!firstName) {
    // Deliberately not "put the animal under a placeholder owner". An animal
    // with no person attached is a record nobody can act on: it cannot be
    // called, reminded or billed, and the vet would meet it as a mystery
    // months later. Reported instead, with its row number.
    return { index, owner: null, pet: null, ownerKey: null, issue: "noOwnerName" };
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

  const petName = text(values, "pet.name");
  const birthColumn = Object.entries(mapping).find(([, f]) => f === "pet.birthDate")?.[0];
  const birthRaw = text(values, "pet.birthDate");
  const weightRaw = text(values, "pet.weightKg");

  const pet: PetDraft | null = petName
    ? {
        name: petName,
        speciesRaw: text(values, "pet.species"),
        breed: text(values, "pet.breed"),
        sexRaw: text(values, "pet.sex"),
        birthDate: birthRaw
          ? parseDate(birthRaw, birthColumn ? dateOrders[Number(birthColumn)] : undefined)
          : null,
        microchipId: text(values, "pet.microchipId"),
        color: text(values, "pet.color"),
        weightKg: weightRaw ? parseWeight(weightRaw) : null,
        notes: text(values, "pet.notes"),
      }
    : null;

  return {
    index,
    owner,
    pet,
    ownerKey: ownerIdentity(firstName, lastName, phone).key,
    issue: pet ? undefined : "noPetName",
  };
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
): ImportPlan {
  const rows = bodyRows.map((cells, i) => planRow(cells, mapping, dateOrders, i + 1));

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

    // No confirmed match. Anybody sharing the name is a question, never an
    // answer -- including a name-mate inside the file itself, which is how
    // the same person typed once with and once without their number looks
    // from here.
    const possible: PossibleMatch[] = [
      ...phoneMates(group, dialled, groups, existing),
      ...sameName.map<PossibleMatch>((c) => ({
        kind: "existing",
        id: c.id,
        name: [c.firstName, c.lastName ?? ""].join(" ").trim(),
        phone: c.phone,
      })),
      ...(groupsByName.get(name ?? "") ?? [])
        .filter((other) => other.key !== group.key)
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
