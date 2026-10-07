import { fold as searchFold } from "@/lib/search";
import type { ColumnEvidence, ColumnKind } from "./infer";

/**
 * Where a column can land, and -- the harder half -- when we are allowed to
 * say so without asking.
 *
 * Two rules hold this file up, and both come from things that were measured
 * rather than assumed.
 *
 * RULE ONE: CONTENT ADMITS, HEADER ONLY ORDERS.
 *
 * A header may never introduce a candidate the values do not already allow. A
 * column of pet names under a heading that says "Tel" is a column of pet
 * names; the vet's file was typed by three people and its headings are a
 * writing habit, so letting one override the values is how a name ends up in
 * the phone field. But among candidates the content ALREADY allows, a heading
 * is honest evidence and throwing it away would be silly: two phone-shaped
 * columns are `phone` and `secondaryPhone` in some order, and "Cep" over one
 * of them is the only thing in the file that says which.
 *
 * RULE TWO: ONE CANDIDATE IS NOT THE SAME AS ONE ANSWER.
 *
 * A proposal is `settled` only when the evidence leaves exactly one target AND
 * the column was decidable in the first place. Everything else is `ask`, and
 * `ask` is not a weaker version of `settled` -- it is the product refusing to
 * decide something the vet has to (#20: the product proposes, it does not
 * rule). Three name-shaped columns with three names in the target list is
 * three questions, not three guesses.
 */

/** A place a spreadsheet column can be imported into. */
export type ImportField =
  // Client
  | "client.firstName"
  | "client.lastName"
  | "client.phone"
  | "client.secondaryPhone"
  | "client.email"
  | "client.city"
  | "client.address"
  | "client.notes"
  // Pet
  | "pet.name"
  | "pet.species"
  | "pet.breed"
  | "pet.sex"
  | "pet.birthDate"
  | "pet.microchipId"
  | "pet.color"
  | "pet.weightKg"
  | "pet.neutered"
  | "pet.notes"
  // Vaccination, two shapes because clinics write it two ways.
  //
  // The TRIO is one vaccine per row: a name column ("Aşı Adı"), its date
  // and its next date. The COLUMN is the other habit, and the one the vet
  // would not switch without: "Kuduz Aşısı" and "Karma Aşı" side by side,
  // each a column of dates whose vaccine is named by the HEADING. Every
  // column sent to `vaccine.column` becomes its own record on every row it
  // is filled in, so one row can carry several vaccinations.
  | "vaccine.name"
  | "vaccine.date"
  | "vaccine.nextDue"
  | "vaccine.column"
  // The column is read and thrown away, on purpose and on the record.
  | "skip";

/** The picker's groups, in the order the screen lists them. */
export const FIELD_GROUPS: ReadonlyArray<{
  group: "client" | "pet" | "vaccine";
  fields: ReadonlyArray<Exclude<ImportField, "skip">>;
}> = [
  {
    group: "client",
    fields: [
      "client.firstName",
      "client.lastName",
      "client.phone",
      "client.secondaryPhone",
      "client.email",
      "client.address",
      "client.city",
      "client.notes",
    ],
  },
  {
    group: "pet",
    fields: [
      "pet.name",
      "pet.species",
      "pet.breed",
      "pet.sex",
      "pet.birthDate",
      "pet.microchipId",
      "pet.color",
      "pet.weightKg",
      "pet.neutered",
      "pet.notes",
    ],
  },
  {
    group: "vaccine",
    fields: ["vaccine.column", "vaccine.name", "vaccine.date", "vaccine.nextDue"],
  },
];

/**
 * Which shapes a field will accept.
 *
 * Deliberately generous on `text`: almost anything can be typed into a name or
 * a note, and a narrow list here would silently drop columns instead of asking
 * about them. Narrowness belongs in `settled`, not in admission.
 */
const ACCEPTS: Record<Exclude<ImportField, "skip">, ColumnKind[]> = {
  "client.firstName": ["text"],
  "client.lastName": ["text"],
  "client.phone": ["phone"],
  "client.secondaryPhone": ["phone"],
  "client.email": ["email"],
  "client.city": ["text"],
  "client.address": ["text"],
  "client.notes": ["text"],
  "pet.name": ["text"],
  "pet.species": ["text"],
  "pet.breed": ["text"],
  "pet.sex": ["text"],
  "pet.birthDate": ["date"],
  "pet.microchipId": ["number", "text"],
  "pet.color": ["text"],
  "pet.weightKg": ["number"],
  "pet.neutered": ["text"],
  "pet.notes": ["text"],
  "vaccine.name": ["text"],
  "vaccine.date": ["date"],
  "vaccine.nextDue": ["date"],
  "vaccine.column": ["date"],
};

/** Fields that hold a date, and so take part in the day-or-month question. */
export const DATE_FIELDS: ReadonlySet<ImportField> = new Set([
  "pet.birthDate",
  "vaccine.date",
  "vaccine.nextDue",
  "vaccine.column",
]);

/**
 * Fields a second column may also be sent to without losing the first.
 * Notes are joined, and every vaccine column is its own record; everything
 * else is one value per row, so a second column there is a question.
 */
export const REPEATABLE_FIELDS: ReadonlySet<ImportField> = new Set([
  "client.notes",
  "pet.notes",
  "vaccine.column",
  "skip",
]);

/**
 * Heading words that ORDER candidates. They never admit one.
 *
 * Matched on whole words of the heading, folded the way search folds
 * (`lib/search.ts`: "Doğum" and "DOGUM" are one word), and a hint word of
 * four letters or more also matches the start of a longer one -- "soyad"
 * finds "Soyadı", "kisir" finds "Kısırlaştırıldı mı". Whole words, because
 * the first version matched anywhere in the heading: "ad" was inside
 * "Adres" and "il" inside "Bilgi". Short words like "Tel" must still hit,
 * which is why the match is on words rather than on a minimum length --
 * "Sahip Tel" is a phone column.
 *
 * Order is specificity: the first entry that matches wins. "Sahip Adı
 * Soyadı" is a full name and must not fall to the surname rule, and
 * "Cinsiyeti" must reach sex before "cins" (breed) sees it.
 *
 * This list is allowed to be incomplete and allowed to be wrong about any
 * particular clinic. That is the point of it only ordering: a missing word
 * costs one extra question, a wrong word costs one wrong ORDER among already
 * valid candidates, and neither can put a value where it does not belong.
 */
const HEADING_HINTS: Array<{ test: (h: Heading) => boolean; field: ImportField }> = [
  { test: (h) => h.any(NEXT_WORDS) && (h.any(VACCINE_WORDS) || h.any(DATE_WORDS)), field: "vaccine.nextDue" },
  { test: (h) => h.vaccine !== null, field: "vaccine.column" },
  { test: (h) => h.any(VACCINE_WORDS) && h.any(DATE_WORDS), field: "vaccine.date" },
  { test: (h) => h.any(VACCINE_WORDS), field: "vaccine.name" },
  { test: (h) => h.any(["ad", "adi", "isim", "isimi", "name"]) && h.any(["soyad", "soyadi", "soyisim", "surname"]), field: "client.firstName" },
  { test: (h) => h.any(["soyad", "soyadi", "soyisim", "surname", "lastname"]) || h.phrase("last name"), field: "client.lastName" },
  { test: (h) => h.phrase("ev tel") || h.phrase("is tel") || h.phrase("diger tel") || h.phrase("2 tel") || h.any(["sabit", "ikinci", "landline"]), field: "client.secondaryPhone" },
  { test: (h) => h.any(["cep", "gsm", "mobil", "tel", "telefon", "numara", "phone", "mobile"]), field: "client.phone" },
  { test: (h) => h.any(["eposta", "email", "mail"]) || h.phrase("e posta") || h.phrase("e mail"), field: "client.email" },
  { test: (h) => h.any(["adres", "address"]), field: "client.address" },
  { test: (h) => h.any(["sehir", "il", "ilce", "city"]), field: "client.city" },
  { test: (h) => h.any(["cinsiyet", "cinsiyeti", "sex", "gender"]), field: "pet.sex" },
  { test: (h) => h.any(["tur", "turu", "species"]), field: "pet.species" },
  { test: (h) => h.any(["irk", "irki", "cins", "cinsi", "breed"]), field: "pet.breed" },
  { test: (h) => h.any(["dogum", "yas", "birth", "dob", "birthday"]) || h.phrase("d tarihi") || h.phrase("d tarih"), field: "pet.birthDate" },
  { test: (h) => h.any(["cip", "mikrocip", "chip", "microchip", "kunye", "transponder"]), field: "pet.microchipId" },
  { test: (h) => h.any(["renk", "rengi", "color", "colour"]), field: "pet.color" },
  { test: (h) => h.any(["kilo", "agirlik", "kg", "weight"]), field: "pet.weightKg" },
  { test: (h) => h.any(["kisir", "kisirlastirildi", "kisirlastirma", "kastre", "neutered", "spayed"]), field: "pet.neutered" },
  { test: (h) => h.any(["hasta", "hayvan", "pet", "patient", "animal"]), field: "pet.name" },
  { test: (h) => h.any(["sahip", "sahibi", "musteri", "veli", "owner", "client", "customer"]), field: "client.firstName" },
  { test: (h) => h.any(["ad", "adi", "isim", "name"]), field: "pet.name" },
  { test: (h) => h.any(["not", "notlar", "notu", "aciklama", "note", "notes", "uyari"]), field: "pet.notes" },
];

const NEXT_WORDS = ["sonraki", "hatirlatma", "tekrar", "rapel", "next", "due", "gelecek"];
const DATE_WORDS = ["tarih", "tarihi", "date"];
const VACCINE_WORDS = ["asi", "asisi", "asilar", "asilari", "asilama", "vaccine", "vaccination", "asi adi"];

/**
 * Vaccine names a heading may carry, each with the name the record gets.
 *
 * The names are the clinic list's own (`lib/vaccines.ts`) where it has one
 * -- "Kuduz", "Karma", "Lösemi" -- so an imported record and one typed at
 * the counter count as the same vaccine in the series and the history
 * suggestion. The rest are words clinics put over a column of dates and
 * are kept as the heading said them.
 */
const VACCINE_NAMES: Array<{ words: string[]; name: string | null }> = [
  { words: ["kuduz", "rabies", "kuduza"], name: "Kuduz" },
  { words: ["karma", "dhpp", "dhppi", "fvrcp", "dhppil", "combination", "combo"], name: "Karma" },
  { words: ["losemi", "felv"], name: "Lösemi" },
  { words: ["leptospiroz", "lepto"], name: "Leptospiroz" },
  { words: ["kennel", "bordetella", "bronchiseptica"], name: "Köpek öksürüğü" },
  { words: ["parvo", "distemper", "genclik", "corona", "koronavirus", "lyme", "giardia", "klamidya", "hepatit", "panlokopeni", "fip", "mantar"], name: null },
];

/** One heading, folded into words once. */
type Heading = {
  any: (words: readonly string[]) => boolean;
  phrase: (phrase: string) => boolean;
  /** The vaccine this heading names, or null. */
  vaccine: string | null;
};

function readHeading(raw: string): Heading {
  const words = searchFold(raw)
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");
  const joined = ` ${words.join(" ")} `;
  const any = (list: readonly string[]) =>
    list.some((hint) =>
      hint.includes(" ")
        ? joined.includes(` ${hint} `)
        : words.some((w) => w === hint || (hint.length >= 4 && w.startsWith(hint))),
    );
  const phrase = (p: string) => joined.includes(` ${p} `);

  let vaccine: string | null = null;
  if (!any(NEXT_WORDS)) {
    if (any(["kopek oksurugu"]) || (any(["oksuruk", "oksurugu"]) && any(["kopek"]))) {
      vaccine = "Köpek öksürüğü";
    } else {
      for (const entry of VACCINE_NAMES) {
        if (!any(entry.words)) continue;
        vaccine = entry.name ?? stripVaccineWords(raw);
        break;
      }
    }
  }
  return { any, phrase, vaccine };
}

/** "Lyme Aşısı Tarihi" -> "Lyme": the heading without the words around the name. */
function stripVaccineWords(raw: string): string {
  const drop = new Set([...VACCINE_WORDS, ...DATE_WORDS, "son", "yapilan", "yapildi"]);
  const kept = raw
    .split(/\s+/)
    .filter((word) => {
      const folded = searchFold(word).replace(/[^a-z0-9]/g, "");
      return folded !== "" && !drop.has(folded) && ![...drop].some((d) => d.length >= 4 && folded.startsWith(d));
    })
    .join(" ")
    .trim();
  return kept || raw.trim();
}

/**
 * The vaccine a heading names, for a column of dates under it.
 *
 * "Kuduz Aşısı" is Kuduz, "Karma Aşı" is Karma, "Lyme" is Lyme. Null when
 * the heading does not name one -- "Aşı Tarihi" says a date is a vaccine's
 * without saying which, and that is the trio's date column, not this.
 */
export function vaccineFromHeading(heading: string | undefined): string | null {
  if (!heading || heading.trim() === "") return null;
  return readHeading(heading).vaccine;
}

/**
 * Every field a heading's words point at, most specific first. Content
 * still has to agree: the caller takes the first one the values admit, so
 * "Çip Numarası" over fifteen-digit numbers is a chip even though
 * "numara" also reads as a phone.
 */
export function hintsFor(heading: string | undefined): ImportField[] {
  if (!heading || heading.trim() === "") return [];
  const h = readHeading(heading);
  return [...new Set(HEADING_HINTS.filter((hint) => hint.test(h)).map((hint) => hint.field))];
}

/** The first field a heading points at, or null. */
export function hintFor(heading: string | undefined): ImportField | null {
  return hintsFor(heading)[0] ?? null;
}

/** Turkish-aware folding: `İ`->`i`, `I`->`ı`, then lowercase. */
export function fold(value: string): string {
  return value.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase().trim();
}

export type Proposal = {
  /** Every field the column's CONTENT allows, best-ordered first. */
  candidates: ImportField[];
  /**
   * True only when the content leaves exactly one candidate and the column was
   * decidable. False means the screen asks -- which is most columns, by design.
   */
  settled: boolean;
  /** The heading that moved the order, if one did. Shown so the vet can see why. */
  orderedBy?: string;
};

export function propose(evidence: ColumnEvidence, heading?: string): Proposal {
  if (evidence.kind === "empty") {
    // Nothing in it. Not a question -- there is no answer to get wrong.
    return { candidates: ["skip"], settled: true };
  }

  const candidates = (Object.keys(ACCEPTS) as Array<Exclude<ImportField, "skip">>)
    .filter((field) => ACCEPTS[field].includes(evidence.kind));

  // The heading may move one candidate to the front, and only if it is
  // already in the list. A "Tel" heading over a column of names moves nothing.
  let orderedBy: string | undefined;
  const hinted = hintsFor(heading).find(
    (field): field is Exclude<ImportField, "skip"> =>
      field !== "skip" && candidates.includes(field as Exclude<ImportField, "skip">),
  );
  if (hinted) {
    orderedBy = heading?.trim();
    candidates.sort((a, b) => (a === hinted ? -1 : b === hinted ? 1 : 0));
  }

  // `skip` is always available and always last: throwing a column away is a
  // choice the vet gets to make about any column, not a fallback we pick.
  const withSkip: ImportField[] = [...candidates, "skip"];

  return {
    // One candidate plus skip is still one real answer; the heading never
    // creates settledness, because ordering a list of two does not shorten it.
    settled: evidence.decidable && candidates.length === 1,
    candidates: withSkip,
    orderedBy,
  };
}

/**
 * What the screen proposes for every column of one sheet, read together.
 *
 * Read together because a column's answer depends on its neighbours: the
 * second phone-shaped column is the second phone, a generic "İsim" is the
 * owner when another column is plainly the animal, and an "Aşı Tarihi"
 * with no vaccine-name column beside it has nobody to be the date of.
 *
 * THREE CONFIDENCES, and what each one does on screen:
 *
 *   recognized -- the heading and the values agree (or the values allow
 *                 one place only). Filled in and listed under "N columns
 *                 recognised", where every one of them can still be
 *                 changed. Nothing here is hidden; it is folded.
 *   suggested  -- one of the two says so and the other does not object:
 *                 a column of phone numbers with no heading, a heading
 *                 of "İsim" when the animal already has a column. Shown
 *                 OPEN, with the proposal as a one-tap chip. Not applied.
 *   none       -- nothing to go on. Asked, with the full list.
 *
 * The house rule stands (#20, the product proposes): a recognized column
 * is an answer the screen shows and the vet can change, the way the
 * species table arrives filled in. What changed is that a column whose
 * heading says "Telefon" over ten phone numbers is no longer a question.
 * It was one, every time, and a vet facing twelve questions for a file
 * that says plainly what it is stops trusting the eleven that matter.
 */
export type Confidence = "recognized" | "suggested" | "none";

/** What the values look like, for the chip's sentence. */
export type LooksLike =
  | "phone"
  | "email"
  | "chip"
  | "date"
  | "species"
  | "sex"
  | "yesNo"
  | "weight";

export type ColumnSuggestion = {
  col: number;
  field: ImportField | null;
  confidence: Confidence;
  looksLike?: LooksLike;
  /** For `vaccine.column`: the vaccine every date in it is a dose of. */
  vaccineName?: string;
};

export type SuggestInput = {
  col: number;
  heading?: string;
  evidence: ColumnEvidence;
  /** The column's non-blank values, for the content signals. */
  values: readonly string[];
};

const SPECIES_WORDS = new Set([
  "kedi", "kopek", "kus", "muhabbet kusu", "kanarya", "papagan", "tavsan", "hamster",
  "kaplumbaga", "balik", "iguana", "gelincik", "kobay", "ginepig", "at", "cat", "dog",
  "bird", "rabbit", "kirpi", "sincap", "fare", "yilan",
]);
const SEX_WORDS = new Set(["erkek", "disi", "e", "d", "m", "f", "male", "female", "k", "kiz"]);
const YES_NO_WORDS = new Set(["evet", "hayir", "yes", "no", "var", "x", "true", "false", "e", "h"]);

function share(values: readonly string[], test: (v: string) => boolean): number {
  if (values.length === 0) return 0;
  return values.filter(test).length / values.length;
}

function contentSignal(evidence: ColumnEvidence, values: readonly string[]): {
  field: ImportField;
  looksLike: LooksLike;
} | null {
  const folded = values.map((v) => searchFold(v.trim()));
  switch (evidence.kind) {
    case "phone":
      return { field: "client.phone", looksLike: "phone" };
    case "email":
      return { field: "client.email", looksLike: "email" };
    case "date":
      return { field: "pet.birthDate", looksLike: "date" };
    case "number":
      if (share(values, (v) => /^\d{15}$/.test(v.trim())) >= 0.8)
        return { field: "pet.microchipId", looksLike: "chip" };
      if (share(values, (v) => { const n = Number(v.replace(",", ".")); return n > 0 && n < 120; }) >= 0.8)
        return { field: "pet.weightKg", looksLike: "weight" };
      return null;
    case "text":
      if (share(values, (v) => /^\d{15}$/.test(v.replace(/\s/g, ""))) >= 0.8)
        return { field: "pet.microchipId", looksLike: "chip" };
      if (share(folded, (v) => SEX_WORDS.has(v)) >= 0.8 && share(folded, (v) => v.length > 1) > 0)
        return { field: "pet.sex", looksLike: "sex" };
      if (share(folded, (v) => YES_NO_WORDS.has(v)) >= 0.8)
        return { field: "pet.neutered", looksLike: "yesNo" };
      if (share(folded, (v) => SPECIES_WORDS.has(v) || [...SPECIES_WORDS].some((w) => v.endsWith(` ${w}`))) >= 0.6)
        return { field: "pet.species", looksLike: "species" };
      return null;
    default:
      return null;
  }
}

/** A heading that names a person or an animal only by "name". */
function isGenericName(heading: string | undefined): boolean {
  const hints = hintsFor(heading);
  return hints[0] === "pet.name" && !hintsFor(heading?.replace(/\b(ad[ıi]?|isim|name)\b/gi, "")).includes("pet.name");
}

export function suggestMapping(columns: readonly SuggestInput[]): ColumnSuggestion[] {
  type Draft = ColumnSuggestion & { generic?: boolean };
  const drafts: Draft[] = columns.map((column) => {
    if (column.evidence.kind === "empty") {
      return { col: column.col, field: "skip", confidence: "recognized" };
    }
    const admitted = propose(column.evidence).candidates.filter((f) => f !== "skip");
    const hinted = hintsFor(column.heading).find((f) => (admitted as ImportField[]).includes(f));
    const signal = contentSignal(column.evidence, column.values);
    if (hinted === "vaccine.column") {
      return {
        col: column.col,
        field: hinted,
        confidence: "recognized",
        vaccineName: vaccineFromHeading(column.heading) ?? undefined,
      };
    }
    if (hinted) {
      return {
        col: column.col,
        field: hinted,
        confidence: "recognized",
        generic: hinted === "pet.name" && isGenericName(column.heading),
      };
    }
    if (column.evidence.kind === "email") {
      return { col: column.col, field: "client.email", confidence: "recognized", looksLike: "email" };
    }
    if (signal && (signal.looksLike === "species" || signal.looksLike === "sex")) {
      // The values themselves name the field -- "Kedi, Köpek, Kedi" is a
      // species column under any heading.
      return { col: column.col, field: signal.field, confidence: "recognized", looksLike: signal.looksLike };
    }
    if (signal) {
      return { col: column.col, field: signal.field, confidence: "suggested", looksLike: signal.looksLike };
    }
    return { col: column.col, field: null, confidence: "none" };
  });

  // A vaccine date needs a vaccine name beside it, or it is a date of
  // nothing. With no name column, the heading is the only name there is,
  // and the column is proposed as a vaccine column under it -- open, so
  // the vet sees the name before it becomes a record.
  const hasNameColumn = drafts.some((d) => d.field === "vaccine.name" && d.confidence === "recognized");
  for (const draft of drafts) {
    const heading = columns.find((c) => c.col === draft.col)?.heading;
    if (!hasNameColumn && (draft.field === "vaccine.date" || draft.field === "vaccine.nextDue")) {
      draft.field = "vaccine.column";
      draft.confidence = "suggested";
      draft.looksLike = "date";
      draft.vaccineName = heading ? stripVaccineWords(heading) : undefined;
    }
    if (draft.field === "vaccine.name" && !drafts.some((d) => d.field === "vaccine.date")) {
      // Names with no dates: the column is still worth keeping, and a note
      // is the one place it can go without inventing a record.
      draft.field = "pet.notes";
      draft.confidence = "suggested";
    }
  }

  // One column per field. Specific headings claim first, generic ones
  // ("İsim", "Adı") after, so the column that says "Hayvan" keeps the
  // animal and the generic one is offered as the owner.
  const used = new Set<ImportField>();
  const order = [...drafts].sort(
    (a, b) =>
      rank(a) - rank(b) || a.col - b.col,
  );
  for (const draft of order) {
    if (!draft.field || REPEATABLE_FIELDS.has(draft.field)) continue;
    if (!used.has(draft.field)) {
      used.add(draft.field);
      continue;
    }
    if (draft.field === "client.phone" && !used.has("client.secondaryPhone")) {
      draft.field = "client.secondaryPhone";
      used.add(draft.field);
      continue;
    }
    if (draft.field === "pet.name" && !used.has("client.firstName")) {
      draft.field = "client.firstName";
      draft.confidence = "suggested";
      used.add(draft.field);
      continue;
    }
    if (draft.field === "pet.birthDate") {
      // A second date column with nothing in its heading: most likely a
      // vaccine, and only the vet knows which.
      draft.field = "vaccine.column";
      draft.confidence = "suggested";
      continue;
    }
    draft.field = null;
    draft.confidence = "none";
  }

  return drafts.map((draft) => {
    const out: ColumnSuggestion = { col: draft.col, field: draft.field, confidence: draft.confidence };
    if (draft.looksLike) out.looksLike = draft.looksLike;
    if (draft.vaccineName) out.vaccineName = draft.vaccineName;
    return out;
  });

  function rank(d: Draft): number {
    if (d.confidence === "recognized" && !d.generic) return 0;
    if (d.confidence === "recognized") return 1;
    return 2;
  }
}
