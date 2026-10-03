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
  | "pet.notes"
  // The column is read and thrown away, on purpose and on the record.
  | "skip";

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
  "pet.notes": ["text"],
};

/**
 * Heading words that ORDER candidates. They never admit one.
 *
 * Folded the Turkish way before matching, because `/i` does not fold `İ` to
 * `i` -- "TELEFON" and "Telefon" must hit the same entry as "telefon", and
 * `"İ".toLowerCase()` produces `i` plus a combining dot that matches nothing.
 *
 * This list is allowed to be incomplete and allowed to be wrong about any
 * particular clinic. That is the point of it only ordering: a missing word
 * costs one extra question, a wrong word costs one wrong ORDER among already
 * valid candidates, and neither can put a value where it does not belong.
 */
const HEADING_HINTS: Array<{ words: string[]; field: ImportField }> = [
  { words: ["cep", "gsm", "mobil"], field: "client.phone" },
  { words: ["ev tel", "is tel", "iş tel", "sabit", "diger tel", "diğer tel", "2. tel", "ikinci"], field: "client.secondaryPhone" },
  { words: ["tel", "telefon", "numara"], field: "client.phone" },
  { words: ["eposta", "e-posta", "email", "mail"], field: "client.email" },
  { words: ["sahip", "musteri", "müşteri", "sahibi", "veli"], field: "client.firstName" },
  { words: ["soyad", "soyisim"], field: "client.lastName" },
  { words: ["adres"], field: "client.address" },
  { words: ["sehir", "şehir", "il", "ilce", "ilçe"], field: "client.city" },
  { words: ["hasta", "hayvan", "pet", "isim", "ad"], field: "pet.name" },
  { words: ["tur", "tür", "cins", "cinsi"], field: "pet.species" },
  { words: ["irk", "ırk"], field: "pet.breed" },
  { words: ["cinsiyet", "erkek", "disi", "dişi"], field: "pet.sex" },
  { words: ["dogum", "doğum", "yas", "yaş"], field: "pet.birthDate" },
  { words: ["cip", "çip", "chip", "mikrocip", "mikroçip", "kunye", "künye"], field: "pet.microchipId" },
  { words: ["renk"], field: "pet.color" },
  { words: ["kilo", "agirlik", "ağırlık", "kg"], field: "pet.weightKg" },
  { words: ["not", "aciklama", "açıklama"], field: "pet.notes" },
];

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
  if (heading && heading.trim() !== "") {
    const folded = fold(heading);
    const hit = HEADING_HINTS.find(
      (h) => h.words.some((w) => folded.includes(w)) && candidates.includes(h.field as Exclude<ImportField, "skip">),
    );
    if (hit) {
      orderedBy = heading.trim();
      candidates.sort((a, b) => (a === hit.field ? -1 : b === hit.field ? 1 : 0));
    }
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
