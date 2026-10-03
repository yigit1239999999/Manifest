// Turning parsed spreadsheet rows into a plan: which owners are new, which
// already exist, which animals go under whom, and why any row is left out.
//
// Pure on purpose. The preview and the import both run this, on the
// server, against the same file and the same mapping, so the screen the
// clinic approved and the rows that get written cannot drift apart. The
// database facts it needs (existing clients, animals, species) come in as
// an argument; nothing in here reads or writes.

import { fold } from "@/lib/search";
import { SPECIES } from "@/modules/pets/schema";
import { builtInSpeciesNamed } from "@/modules/pets/species-names";
import type { Species } from "@/generated/prisma/enums";
import { fieldIndex, type ColumnMapping, type ImportField } from "./fields";
import {
  clean,
  nameKey,
  readDate,
  readEmail,
  readMicrochip,
  readPhone,
  readSex,
  readWeight,
  readYesNo,
  splitFullName,
  type DateCell,
  type DateOrder,
  type SexValue,
  dateOrderEvidence,
} from "./normalize";

export type DateField = "birthDate" | "vaccineDate" | "vaccineNextDue";

/**
 * Every reason a row can carry. The UI turns each into a sentence; the
 * code is what travels, so the same reason reads the same everywhere and
 * the skipped-rows report can be written in the reader's language.
 */
export type Issue =
  | { code: "ownerNameMissing" }
  | { code: "ownerNameSingle"; name: string }
  | { code: "petNameMissing" }
  | { code: "speciesMissing" }
  | { code: "dateAmbiguous"; field: DateField; raw: string }
  | { code: "dateInvalid"; field: DateField; raw: string }
  | { code: "dateYearOnly"; field: DateField; raw: string }
  | { code: "dateFuture"; field: DateField; raw: string }
  | { code: "phoneInvalid"; raw: string }
  | { code: "emailInvalid"; raw: string }
  | { code: "sexUnknown"; raw: string }
  | { code: "neuteredUnknown"; raw: string }
  | { code: "weightInvalid"; raw: string }
  | { code: "microchipScientific"; raw: string }
  | { code: "microchipInvalid"; raw: string }
  | { code: "speciesNew"; name: string }
  | { code: "vaccineNoDate"; name: string }
  | { code: "vaccineNoName" }
  | { code: "nextDueBeforeGiven" }
  | { code: "textTruncated"; field: ImportField }
  | { code: "sameContactOtherName"; name: string; line: number }
  | { code: "noContactJoined"; line: number }
  | { code: "noContactManyNames" }
  | { code: "existingNameNoContact" }
  | { code: "archivedMatch" }
  | { code: "duplicateInFile"; line: number }
  | { code: "petExists"; name: string }
  | { code: "chipExists"; chip: string }
  | { code: "chipInFile"; line: number };

export type IssueCode = Issue["code"];

const ERRORS: ReadonlySet<IssueCode> = new Set([
  "ownerNameMissing",
  "ownerNameSingle",
  "petNameMissing",
  "speciesMissing",
  "dateAmbiguous",
]);

const DUPLICATES: ReadonlySet<IssueCode> = new Set([
  "duplicateInFile",
  "petExists",
  "chipExists",
  "chipInFile",
]);

export type IssueSeverity = "error" | "duplicate" | "warning";

export function severityOf(code: IssueCode): IssueSeverity {
  if (ERRORS.has(code)) return "error";
  if (DUPLICATES.has(code)) return "duplicate";
  return "warning";
}

/**
 * - ready: goes in exactly as written
 * - warning: goes in, and something about it is worth a look
 * - error: stays out until the file or a choice above the table is fixed
 * - duplicate: stays out because it is already there
 */
export type RowStatus = "ready" | "warning" | "error" | "duplicate";

export type SpeciesRef =
  | { kind: "builtIn"; species: Species }
  | { kind: "custom"; id: string; name: string }
  | { kind: "new"; name: string };

export interface OwnerPlan {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  /** Set when the owner is already a client: animals go under them. */
  existing: { id: string; name: string } | null;
}

export interface PetPlan {
  name: string;
  species: SpeciesRef;
  breed: string | null;
  sex: SexValue;
  neutered: boolean;
  birthDate: string | null;
  color: string | null;
  microchipId: string | null;
  weightKg: number | null;
  notes: string | null;
}

export interface VaccinePlan {
  name: string;
  date: string;
  nextDue: string | null;
}

export interface AnalyzedRow {
  /** The row number as the spreadsheet shows it, header included. */
  line: number;
  status: RowStatus;
  issues: Issue[];
  /** Owner name as the row wrote it, for the table. */
  ownerLabel: string;
  ownerId: string | null;
  pet: PetPlan | null;
  vaccine: VaccinePlan | null;
}

export interface SpeciesQuestion {
  key: string;
  label: string;
  rows: number;
  choice: string;
}

export interface Analysis {
  rows: AnalyzedRow[];
  owners: OwnerPlan[];
  counts: {
    rows: number;
    blank: number;
    pets: number;
    newClients: number;
    existingClients: number;
    vaccinations: number;
    skipped: number;
    errors: number;
    duplicates: number;
    warnings: number;
    newSpecies: number;
  };
  species: SpeciesQuestion[];
  dates: {
    /** Cells that need the order question answered to be read at all. */
    ambiguous: number;
    order: DateOrder | null;
    evidence: { dmy: number; mdy: number };
  };
}

export interface AnalyzeOptions {
  dateOrder: DateOrder | null;
  /** Folded species text → "DOG" | "custom:<id>" | "new". */
  speciesChoices: Record<string, string>;
  today?: Date;
}

export interface ExistingData {
  clients: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    secondaryPhone: string | null;
    email: string | null;
    archived: boolean;
  }[];
  /** Animals of the clients the file might match, and any sharing a chip with it. */
  pets: { ownerId: string; name: string; microchipId: string | null }[];
  customSpecies: { id: string; name: string }[];
}

/** Same limits the client and animal forms enforce (`modules/*\/schema.ts`). */
const LIMITS: Partial<Record<ImportField, number>> = {
  ownerFirstName: 80,
  ownerLastName: 80,
  address: 200,
  city: 80,
  ownerNotes: 2000,
  petName: 80,
  breed: 80,
  color: 60,
  petNotes: 2000,
  vaccineName: 120,
};

const SPECIES_SET: ReadonlySet<string> = new Set(SPECIES);

export function speciesKey(raw: string): string {
  return fold(clean(raw));
}

/** Phone and e-mail keys a file contains, so only their owners are loaded. */
export function contactKeys(
  rows: readonly string[][],
  mapping: ColumnMapping,
): { phones: string[]; emails: string[]; chips: string[] } {
  const at = fieldIndex(mapping);
  const phones = new Set<string>();
  const emails = new Set<string>();
  const chips = new Set<string>();
  for (const row of rows) {
    const cell = (f: ImportField) => (at[f] === undefined ? "" : (row[at[f]!] ?? ""));
    const phone = readPhone(cell("phone"));
    if (phone.kind === "ok") phones.add(phone.key);
    const email = readEmail(cell("email"));
    if (email.kind === "ok") emails.add(email.key);
    const chip = readMicrochip(cell("microchip"));
    if (chip.kind === "ok") chips.add(chip.chip);
  }
  return { phones: [...phones], emails: [...emails], chips: [...chips] };
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  /** The smaller index wins, so a group is named after its first row. */
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (ra < rb) this.parent[rb] = ra;
    else this.parent[ra] = rb;
  }
}

interface OwnerRead {
  first: string;
  last: string;
  key: string;
  phones: string[];
  phone: string | null;
  secondaryPhone: string | null;
  emailKey: string | null;
  email: string | null;
}

/**
 * Reads every row against the mapping and the clinic's existing records.
 *
 * `rows` are data rows only, header removed; `firstLine` is the sheet row
 * number of the first of them, so a reason can point at "satır 14" and the
 * clinic finds it in their own file.
 */
export function analyzeRows(
  rows: readonly string[][],
  mapping: ColumnMapping,
  existing: ExistingData,
  options: AnalyzeOptions,
  firstLine = 2,
): Analysis {
  const today = options.today ?? new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const at = fieldIndex(mapping);
  const cellOf = (row: readonly string[], f: ImportField) =>
    at[f] === undefined ? "" : String(row[at[f]!] ?? "");

  const blankRow = (row: readonly string[]) =>
    mapping.every((f, i) => !f || clean(row[i]) === "");

  const entries = rows
    .map((row, i) => ({ row, line: firstLine + i }))
    .filter(({ row }) => !blankRow(row));
  const blank = rows.length - entries.length;

  const issues: Issue[][] = entries.map(() => []);
  const truncate = (i: number, field: ImportField, value: string): string | null => {
    const text = clean(value);
    if (!text) return null;
    const max = LIMITS[field];
    if (max && text.length > max) {
      issues[i].push({ code: "textTruncated", field });
      return text.slice(0, max);
    }
    return text;
  };

  // --- owners: read --------------------------------------------------------
  const owners: (OwnerRead | null)[] = entries.map(({ row }, i) => {
    let first = clean(cellOf(row, "ownerFirstName"));
    let last = clean(cellOf(row, "ownerLastName"));
    if (!first || !last) {
      const split = splitFullName(cellOf(row, "ownerName"));
      if (split && "first" in split) {
        first ||= split.first;
        last ||= split.last;
      } else if (split && "single" in split) {
        // Half a name from the full-name column, completed by whichever
        // of the separate columns is there.
        if (!first && last) first = split.single;
        else if (first && !last) last = split.single;
        else if (!first && !last) {
          issues[i].push({ code: "ownerNameSingle", name: split.single });
          return null;
        }
      }
    }
    if (!first || !last) {
      if (first || last) issues[i].push({ code: "ownerNameSingle", name: first || last });
      else issues[i].push({ code: "ownerNameMissing" });
      return null;
    }
    first = truncate(i, "ownerFirstName", first)!;
    last = truncate(i, "ownerLastName", last)!;

    const phone = readPhone(cellOf(row, "phone"));
    if (phone.kind === "invalid") issues[i].push({ code: "phoneInvalid", raw: phone.raw });
    const email = readEmail(cellOf(row, "email"));
    if (email.kind === "invalid") issues[i].push({ code: "emailInvalid", raw: email.raw });

    const phones: string[] = [];
    if (phone.kind === "ok") {
      phones.push(phone.key);
      const second = phone.secondary ? readPhone(phone.secondary) : null;
      if (second?.kind === "ok") phones.push(second.key);
    }
    return {
      first,
      last,
      key: nameKey(first, last),
      phones,
      phone: phone.kind === "ok" ? phone.phone : null,
      secondaryPhone: phone.kind === "ok" ? phone.secondary : null,
      emailKey: email.kind === "ok" ? email.key : null,
      email: email.kind === "ok" ? email.email : null,
    };
  });

  // --- owners: group within the file -------------------------------------
  const uf = new UnionFind(entries.length);
  const byContact = new Map<string, number>();
  owners.forEach((o, i) => {
    if (!o) return;
    for (const k of [...o.phones.map((p) => `p:${p}`), ...(o.emailKey ? [`e:${o.emailKey}`] : [])]) {
      const seen = byContact.get(k);
      if (seen === undefined) byContact.set(k, i);
      else uf.union(seen, i);
    }
  });

  // A row with no phone and no e-mail can only be told apart by name. Two
  // such rows with one name are one person -- the second animal of an
  // owner whose number was written once. One such row beside exactly one
  // contactable owner of the same name joins them; beside two, it cannot
  // be placed honestly and becomes its own client, with the reason shown.
  const noContact = (o: OwnerRead | null): boolean =>
    !!o && o.phones.length === 0 && !o.emailKey;
  const firstNoContactByName = new Map<string, number>();
  owners.forEach((o, i) => {
    if (!o || !noContact(o)) return;
    const seen = firstNoContactByName.get(o.key);
    if (seen === undefined) firstNoContactByName.set(o.key, i);
    else {
      uf.union(seen, i);
      issues[i].push({ code: "noContactJoined", line: entries[seen].line });
    }
  });
  for (const [key, i] of firstNoContactByName) {
    const roots = new Set<number>();
    owners.forEach((o, j) => {
      if (o && !noContact(o) && o.key === key) roots.add(uf.find(j));
    });
    if (roots.size === 1) {
      const root = [...roots][0];
      uf.union(root, i);
      owners.forEach((o, j) => {
        if (o && noContact(o) && o.key === key && !issues[j].some((x) => x.code === "noContactJoined"))
          issues[j].push({ code: "noContactJoined", line: entries[root].line });
      });
    } else if (roots.size > 1) {
      owners.forEach((o, j) => {
        if (o && noContact(o) && o.key === key) issues[j].push({ code: "noContactManyNames" });
      });
    }
  }

  // --- owners: build plans, and match the clinic's existing clients --------
  const existingByPhone = new Map<string, ExistingData["clients"][number]>();
  const existingByEmail = new Map<string, ExistingData["clients"][number]>();
  const existingByName = new Map<string, ExistingData["clients"][number]>();
  // Active clients first, so a live record wins over an archived one that
  // shares its number.
  const ordered = [...existingByOrder(existing.clients)];
  for (const c of ordered) {
    for (const p of [c.phone, c.secondaryPhone]) {
      const k = readPhone(p ?? "");
      if (k.kind === "ok" && !existingByPhone.has(k.key)) existingByPhone.set(k.key, c);
    }
    const e = readEmail(c.email ?? "");
    if (e.kind === "ok" && !existingByEmail.has(e.key)) existingByEmail.set(e.key, c);
    if (!c.archived) {
      const k = nameKey(c.firstName, c.lastName);
      if (!existingByName.has(k)) existingByName.set(k, c);
    }
  }

  const plans = new Map<number, OwnerPlan>();
  const groupRows = new Map<number, number[]>();
  owners.forEach((o, i) => {
    if (!o) return;
    const root = uf.find(i);
    const list = groupRows.get(root) ?? [];
    list.push(i);
    groupRows.set(root, list);
  });

  for (const [root, members] of groupRows) {
    const head = owners[root]!;
    const pick = (f: ImportField) => {
      for (const i of members) {
        const v = truncate(i, f, cellOf(entries[i].row, f));
        if (v) return v;
      }
      return null;
    };
    const firstOf = <T>(get: (o: OwnerRead) => T | null): T | null => {
      for (const i of members) {
        const v = get(owners[i]!);
        if (v) return v;
      }
      return null;
    };
    const phones = [...new Set(members.flatMap((i) => owners[i]!.phones))];
    const emails = [...new Set(members.map((i) => owners[i]!.emailKey).filter(Boolean))] as string[];

    // Phone before e-mail: a number is what the clinic calls, and what the
    // old records were most likely kept by.
    let match: ExistingData["clients"][number] | undefined;
    let archivedHit = false;
    for (const c of [
      ...phones.map((p) => existingByPhone.get(p)),
      ...emails.map((e) => existingByEmail.get(e)),
    ]) {
      if (!c) continue;
      if (c.archived) archivedHit = true;
      else match ??= c;
    }
    // An archived client is not brought back by a spreadsheet: their
    // animals would go under a record nobody sees. Said, not decided.
    if (!match && archivedHit) {
      for (const i of members) issues[i].push({ code: "archivedMatch" });
    }
    if (!match && phones.length === 0 && emails.length === 0 && existingByName.has(head.key)) {
      for (const i of members) issues[i].push({ code: "existingNameNoContact" });
    }

    for (const i of members) {
      if (i !== root && owners[i]!.key !== head.key && !noContact(owners[i]))
        issues[i].push({
          code: "sameContactOtherName",
          name: `${head.first} ${head.last}`,
          line: entries[root].line,
        });
    }

    plans.set(root, {
      id: `o${entries[root].line}`,
      firstName: head.first,
      lastName: head.last,
      phone: firstOf((o) => o.phone),
      secondaryPhone: firstOf((o) => o.secondaryPhone),
      email: firstOf((o) => o.email),
      address: pick("address"),
      city: pick("city"),
      notes: pick("ownerNotes"),
      existing: match
        ? { id: match.id, name: `${match.firstName} ${match.lastName}` }
        : null,
    });
  }

  // --- animals --------------------------------------------------------------
  const builtInOf = (raw: string): Species | null => builtInSpeciesNamed(raw);
  const customByKey = new Map(existing.customSpecies.map((c) => [fold(c.name), c]));
  const customById = new Map(existing.customSpecies.map((c) => [c.id, c]));
  const speciesQuestions = new Map<string, SpeciesQuestion>();

  const existingPetNames = new Map<string, Set<string>>();
  const existingChips = new Set<string>();
  for (const p of existing.pets) {
    const set = existingPetNames.get(p.ownerId) ?? new Set<string>();
    set.add(fold(clean(p.name)));
    existingPetNames.set(p.ownerId, set);
    if (p.microchipId) existingChips.add(p.microchipId.replace(/[\s-]+/g, "").toUpperCase());
  }
  const seenPets = new Map<string, number>();
  const seenChips = new Map<string, number>();

  const dateValues: string[] = [];
  let ambiguous = 0;
  const date = (i: number, field: DateField): string | null => {
    const raw = cellOf(entries[i].row, field);
    if (raw.trim()) dateValues.push(raw);
    const firstRead = readDate(raw, null, today);
    if (firstRead.kind === "ambiguous") ambiguous += 1;
    const cell: DateCell =
      firstRead.kind === "ambiguous" ? readDate(raw, options.dateOrder, today) : firstRead;
    switch (cell.kind) {
      case "empty":
        return null;
      case "ok":
        return cell.date;
      case "ambiguous":
        issues[i].push({ code: "dateAmbiguous", field, raw: cell.raw });
        return null;
      case "invalid":
        issues[i].push({
          code: cell.reason === "yearOnly" ? "dateYearOnly" : "dateInvalid",
          field,
          raw: cell.raw,
        });
        return null;
    }
  };

  const analyzed: AnalyzedRow[] = entries.map(({ row, line }, i) => {
    const owner = owners[i];
    const plan = owner ? plans.get(uf.find(i))! : null;

    const name = truncate(i, "petName", cellOf(row, "petName"));
    if (!name) issues[i].push({ code: "petNameMissing" });

    // Species.
    let species: SpeciesRef | null = null;
    const rawSpecies = clean(cellOf(row, "species"));
    if (!rawSpecies) issues[i].push({ code: "speciesMissing" });
    else {
      const builtIn = builtInOf(rawSpecies);
      const custom = customByKey.get(fold(rawSpecies));
      if (builtIn) species = { kind: "builtIn", species: builtIn };
      else if (custom) species = { kind: "custom", id: custom.id, name: custom.name };
      else {
        const key = speciesKey(rawSpecies);
        const choice = options.speciesChoices[key] ?? "new";
        const q = speciesQuestions.get(key) ?? { key, label: rawSpecies, rows: 0, choice: "new" };
        q.rows += 1;
        speciesQuestions.set(key, q);
        if (SPECIES_SET.has(choice)) {
          species = { kind: "builtIn", species: choice as Species };
          q.choice = choice;
        } else if (choice.startsWith("custom:") && customById.has(choice.slice(7))) {
          const c = customById.get(choice.slice(7))!;
          species = { kind: "custom", id: c.id, name: c.name };
          q.choice = choice;
        } else {
          // Every spelling in the file becomes the first one seen, so
          // "Muhabbet kuşu" and "muhabbet kusu" add one species, not two.
          species = { kind: "new", name: q.label.slice(0, 60) };
          issues[i].push({ code: "speciesNew", name: q.label });
        }
      }
    }

    // Sex and neutering.
    const sexCell = readSex(cellOf(row, "sex"));
    if (sexCell.kind === "invalid") issues[i].push({ code: "sexUnknown", raw: sexCell.raw });
    const neuteredCell = readYesNo(cellOf(row, "neutered"));
    if (neuteredCell.kind === "invalid")
      issues[i].push({ code: "neuteredUnknown", raw: neuteredCell.raw });
    const neutered =
      neuteredCell.kind === "ok"
        ? neuteredCell.value
        : sexCell.kind === "ok" && sexCell.neutered;

    // Dates.
    let birthDate = date(i, "birthDate");
    if (birthDate && birthDate > todayIso) {
      issues[i].push({ code: "dateFuture", field: "birthDate", raw: cellOf(row, "birthDate").trim() });
      birthDate = null;
    }

    const weightCell = readWeight(cellOf(row, "weight"));
    if (weightCell.kind === "invalid") issues[i].push({ code: "weightInvalid", raw: weightCell.raw });

    const chipCell = readMicrochip(cellOf(row, "microchip"));
    if (chipCell.kind === "invalid")
      issues[i].push({
        code: chipCell.reason === "scientific" ? "microchipScientific" : "microchipInvalid",
        raw: chipCell.raw,
      });
    const chip = chipCell.kind === "ok" ? chipCell.chip : null;

    // Vaccination.
    const vaccineName = truncate(i, "vaccineName", cellOf(row, "vaccineName"));
    let given = date(i, "vaccineDate");
    let nextDue = date(i, "vaccineNextDue");
    if (given && given > todayIso) {
      issues[i].push({ code: "dateFuture", field: "vaccineDate", raw: cellOf(row, "vaccineDate").trim() });
      given = null;
    }
    let vaccine: VaccinePlan | null = null;
    if (vaccineName && given) {
      if (nextDue && nextDue < given) {
        issues[i].push({ code: "nextDueBeforeGiven" });
        nextDue = null;
      }
      vaccine = { name: vaccineName, date: given, nextDue };
    } else if (vaccineName) {
      // A vaccination with no date would be stored as given today, which
      // is a clinical record of something that did not happen today.
      if (!issues[i].some((x) => x.code === "dateAmbiguous" && x.field === "vaccineDate"))
        issues[i].push({ code: "vaccineNoDate", name: vaccineName });
    } else if (given || nextDue) {
      issues[i].push({ code: "vaccineNoName" });
    }

    // Already here: in the clinic, or earlier in this file. Only checked
    // once the row is otherwise importable, so a row is never reported as
    // a duplicate of a row that is itself being left out.
    const fatal = issues[i].some((x) => severityOf(x.code) === "error");
    if (!fatal && plan && name) {
      const ownerRef = plan.existing?.id ?? plan.id;
      const petKey = `${ownerRef}|${fold(name)}`;
      if (plan.existing && existingPetNames.get(plan.existing.id)?.has(fold(name)))
        issues[i].push({ code: "petExists", name });
      else if (chip && existingChips.has(chip)) issues[i].push({ code: "chipExists", chip });
      else if (seenPets.has(petKey))
        issues[i].push({ code: "duplicateInFile", line: seenPets.get(petKey)! });
      else if (chip && seenChips.has(chip))
        issues[i].push({ code: "chipInFile", line: seenChips.get(chip)! });
      else {
        seenPets.set(petKey, line);
        if (chip) seenChips.set(chip, line);
      }
    }

    const severities = issues[i].map((x) => severityOf(x.code));
    const status: RowStatus = severities.includes("error")
      ? "error"
      : severities.includes("duplicate")
        ? "duplicate"
        : severities.length > 0
          ? "warning"
          : "ready";

    const importable = status === "ready" || status === "warning";
    return {
      line,
      status,
      issues: issues[i],
      ownerLabel: owner
        ? `${owner.first} ${owner.last}`
        : clean(cellOf(row, "ownerName")) ||
          clean(`${cellOf(row, "ownerFirstName")} ${cellOf(row, "ownerLastName")}`),
      ownerId: plan?.id ?? null,
      pet:
        importable && name && species
          ? {
              name,
              species,
              breed: truncate(i, "breed", cellOf(row, "breed")),
              sex: sexCell.kind === "ok" ? sexCell.sex : "UNKNOWN",
              neutered,
              birthDate,
              color: truncate(i, "color", cellOf(row, "color")),
              microchipId: chip,
              weightKg: weightCell.kind === "ok" ? weightCell.kg : null,
              notes: truncate(i, "petNotes", cellOf(row, "petNotes")),
            }
          : null,
      vaccine: importable ? vaccine : null,
    };
  });

  // Owners nobody will be created for are dropped from the plan, so the
  // count on screen is the count that gets written.
  const usedOwners = new Set(analyzed.filter((r) => r.pet).map((r) => r.ownerId));
  const ownerList = [...plans.values()].filter((o) => usedOwners.has(o.id));
  const newSpecies = new Set(
    analyzed.flatMap((r) => (r.pet?.species.kind === "new" ? [fold(r.pet.species.name)] : [])),
  );

  const count = (s: RowStatus) => analyzed.filter((r) => r.status === s).length;
  return {
    rows: analyzed,
    owners: ownerList,
    counts: {
      rows: analyzed.length,
      blank,
      pets: analyzed.filter((r) => r.pet).length,
      newClients: ownerList.filter((o) => !o.existing).length,
      existingClients: new Set(ownerList.flatMap((o) => (o.existing ? [o.existing.id] : []))).size,
      vaccinations: analyzed.filter((r) => r.vaccine).length,
      skipped: count("error") + count("duplicate"),
      errors: count("error"),
      duplicates: count("duplicate"),
      warnings: count("warning"),
      newSpecies: newSpecies.size,
    },
    species: [...speciesQuestions.values()].sort((a, b) => b.rows - a.rows),
    dates: {
      ambiguous,
      order: ambiguous > 0 ? options.dateOrder : null,
      evidence: dateOrderEvidence(dateValues),
    },
  };
}

function* existingByOrder(clients: ExistingData["clients"]) {
  yield* clients.filter((c) => !c.archived);
  yield* clients.filter((c) => c.archived);
}
