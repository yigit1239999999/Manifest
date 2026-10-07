import { allergyConflict } from "./errors";
import { fold } from "./search";

/**
 * Does a drug about to be written down collide with what the animal's
 * record says it reacts to?
 *
 * The record keeps allergies as one free-text field ("AMOKSİSİLİN
 * ALERJİSİ", "Penisilin alerjisi; ısırır"), so this reads text, not a
 * coded allergy list. Two kinds of match, both on accent- and
 * case-folded words (the same `fold` the search uses, so I, İ, ı and i
 * are one letter):
 *
 *  1. Direct: a word of the drug name and a word of the alert contain one
 *     another ("amoksisilin" in "Amoksisilin + Klavulanik asit"). Words
 *     shorter than five letters and the alert's own vocabulary ("alerji",
 *     "reaksiyon", "ilaç") are not compared, or "asit" and "alerjisi"
 *     would match everything.
 *  2. Family: both sides name a member (or the family itself) of one of the
 *     three families in `FAMILIES` below. A penicillin allergy and an
 *     ampicillin prescription share no word and are the same problem.
 *
 * What this deliberately does NOT know, so nobody reads it as more:
 *  - Brand names (Synulox, Rimadyl, Metacam). It reads active ingredients
 *    only; a brand typed alone is not caught.
 *  - Cross-reactivity between families (penicillin to cephalosporin, and
 *    so on). That is a clinical judgement with a percentage attached, not
 *    a lookup, and it is left to the vet.
 *  - Any family other than the three below. They are the obvious ones a
 *    clinic writes as an allergy, nothing more.
 *  - Whether the alert text is an allergy at all. "Meloksikam sonrası
 *    kusma" is an adverse reaction and is flagged the same way, which is
 *    the safe direction to be wrong in: the vet can write it anyway, with
 *    a reason.
 *
 * Families follow the WHO ATC groups they are named after (J01C
 * beta-lactam penicillins, J01E sulfonamides, M01A non-steroidal
 * anti-inflammatories), limited to the members used in small-animal
 * practice. Each member carries its Turkish and English spellings, which
 * also makes "amoxicillin" against "amoksisilin" a direct match.
 */

export type AllergyFamily = "penicillin" | "sulfonamide" | "nsaid";

interface Family {
  key: AllergyFamily;
  /**
   * Words that name the family itself. Matched at the start of a word
   * ("penisilinler", "penisiline"), except where noted.
   */
  names: string[];
  /** Exact-word family names: too short or too common to use as a prefix. */
  exactNames?: string[];
  /** One entry per active ingredient, every spelling in the same list. */
  members: string[][];
}

const FAMILIES: Family[] = [
  {
    // ATC J01C.
    key: "penicillin",
    names: ["penisilin", "penicillin"],
    members: [
      ["benzilpenisilin", "benzylpenicillin", "penisilin g", "penicillin g"],
      ["prokain penisilin", "procaine penicillin"],
      ["benzatin penisilin", "benzathine penicillin"],
      ["amoksisilin", "amoxicillin", "amoxycillin", "amoksicilin"],
      ["ampisilin", "ampicillin"],
      // Longest first: "dikloksasilin" contains both names after it.
      ["dikloksasilin", "dicloxacillin"],
      ["kloksasilin", "cloxacillin"],
      ["oksasilin", "oxacillin"],
      ["tikarsilin", "ticarcillin"],
      ["piperasilin", "piperacillin"],
    ],
  },
  {
    // ATC J01E. Trimethoprim is in the same ATC group but is not itself a
    // sulfonamide, so it is not a member: "trimetoprim-sulfametoksazol" is
    // caught by its second half.
    key: "sulfonamide",
    names: ["sulfonamid"],
    // "sulfa" only as a whole word. As a prefix it is "sulfat", the salt in
    // "gentamisin sülfat" and "atropin sülfat", which has nothing to do with
    // a sulfa allergy.
    exactNames: ["sulfa"],
    members: [
      ["sulfametoksazol", "sulfamethoxazole"],
      ["sulfadiazin", "sulfadiazine"],
      ["sulfadimetoksin", "sulfadimethoxine"],
      ["sulfadimidin", "sulfadimidine", "sulfametazin", "sulfamethazine"],
      ["sulfaguanidin", "sulfaguanidine"],
      ["sulfasalazin", "sulfasalazine"],
      ["sulfakinoksalin", "sulfaquinoxaline"],
    ],
  },
  {
    // ATC M01A. Metamizole and paracetamol are analgesics outside M01A and
    // are not members.
    key: "nsaid",
    names: ["nonsteroid", "steroid olmayan"],
    exactNames: ["nsaii", "nsai", "nsaid", "nsaids", "nsaim"],
    members: [
      ["meloksikam", "meloxicam"],
      ["karprofen", "carprofen"],
      ["robenakoksib", "robenacoxib"],
      ["firokoksib", "firocoxib"],
      ["derakoksib", "deracoxib"],
      ["mavakoksib", "mavacoxib"],
      ["simikoksib", "cimicoxib"],
      ["ketoprofen"],
      ["tolfenamik", "tolfenamic"],
      ["fluniksin", "flunixin"],
      ["asetilsalisilik", "acetylsalicylic", "aspirin"],
      ["ibuprofen"],
      ["diklofenak", "diclofenac"],
      ["naproksen", "naproxen"],
      ["fenilbutazon", "phenylbutazone"],
      ["grapiprant"],
    ],
  },
];

/**
 * Words of an alert that say "this is an allergy", not what it is to.
 * Folded. Compared whole, never as part of a word.
 */
const ALERT_WORDS = new Set([
  "alerji", "alerjisi", "alerjik", "alerjen", "alerjileri",
  "allergy", "allergic", "allergies", "reaksiyon", "reaksiyonu", "reaction",
  "hassasiyet", "hassasiyeti", "duyarlilik", "duyarliligi", "intolerans",
  "intolerance", "sensitivity", "dikkat", "ilaci", "ilaclar", "ilaclari",
  "grubu", "group", "sonrasi", "after", "kullanmayin", "verilmez",
  "verilmemeli", "yasak", "kontrendike", "contraindicated", "olabilir",
]);

/** Words of a drug name that are its form or salt, not what it is. */
const DRUG_WORDS = new Set([
  "asit", "acid", "tablet", "kapsul", "capsule", "surup", "syrup",
  "damla", "drops", "enjeksiyon", "injection", "enjektabl", "injectable",
  "solusyon", "solution", "suspansiyon", "suspension", "pomad", "krem",
  "cream", "merhem", "ointment", "flakon", "sodyum", "sodium", "potasyum",
  "potassium", "trihidrat", "trihydrate", "sulfat", "sulphate", "sulfate",
  "hidroklorur", "hydrochloride", "forte", "plus",
]);

const MIN_WORD = 5;

/** Folded words, split on anything that is not a letter or a digit. */
function words(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Folded text with every run of non-letters as one space, padded. */
function spaced(text: string): string {
  return ` ${words(text).join(" ")} `;
}

function mentions(text: string, family: Family): { member: number | null } | null {
  const s = spaced(text);
  for (const [i, spellings] of family.members.entries()) {
    // A member may be glued to its partner ("amoksisilinklavulanat"), so
    // a spelling is found anywhere a word starts.
    if (spellings.some((sp) => s.includes(` ${sp}`) || wordsContain(s, sp))) {
      return { member: i };
    }
  }
  if (family.names.some((n) => s.includes(` ${n}`))) return { member: null };
  if (family.exactNames?.some((n) => s.includes(` ${n} `))) return { member: null };
  return null;
}

function wordsContain(s: string, spelling: string): boolean {
  // Multi-word spellings only match as written, with the space.
  if (spelling.includes(" ")) return false;
  return s.split(" ").some((w) => w.length > spelling.length && w.includes(spelling));
}

export interface AllergyConflict {
  /** The alert's sentence that matched, as the clinic wrote it. */
  allergy: string;
  /** The drug as it was typed. */
  drug: string;
  /** Set when the match is through a family rather than a shared word. */
  family: AllergyFamily | null;
}

/**
 * The alert broken into the parts a person wrote as separate statements,
 * so the warning can quote the one that matched rather than the whole
 * field ("Penisilin alerjisi", not "Penisilin alerjisi; ısırır; kalp").
 */
function statements(alerts: string): string[] {
  return alerts
    .split(/[\n;,.•]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function findAllergyConflict(
  alerts: string | null | undefined,
  drug: string | null | undefined,
): AllergyConflict | null {
  if (!alerts?.trim() || !drug?.trim()) return null;
  const drugWords = words(drug).filter(
    (w) => w.length >= MIN_WORD && !DRUG_WORDS.has(w),
  );

  for (const statement of statements(alerts)) {
    const alertWords = words(statement).filter(
      (w) => w.length >= MIN_WORD && !ALERT_WORDS.has(w),
    );

    // Families first: when one applies, the warning can name it, and
    // "penisilin grubu" tells the vet why two different names collided.
    for (const family of FAMILIES) {
      const inAlert = mentions(statement, family);
      if (!inAlert) continue;
      const inDrug = mentions(drug, family);
      if (!inDrug) continue;
      const sameMember =
        inAlert.member !== null && inAlert.member === inDrug.member;
      return {
        allergy: statement,
        drug: drug.trim(),
        family: sameMember ? null : family.key,
      };
    }

    const direct = alertWords.some((a) =>
      drugWords.some((d) => d.includes(a) || a.includes(d)),
    );
    if (direct) return { allergy: statement, drug: drug.trim(), family: null };
  }
  return null;
}

/** Shortest reason that says something. "x" is a click, not a reason. */
export const OVERRIDE_REASON_MIN = 5;

/**
 * The server's half of the check, shared by every write that gives an
 * animal a drug. Returns the conflict when the vet wrote it anyway with a
 * reason (so the caller stores the reason and audits it), null when there
 * is nothing to excuse, and throws when there is and no reason came with
 * it. Enforced here rather than in the form: the form is one client of the
 * action, not the only one.
 */
export function requireAllergyOverride(
  alerts: string | null | undefined,
  drug: string,
  reason: string | null | undefined,
): { conflict: AllergyConflict; reason: string } | null {
  const conflict = findAllergyConflict(alerts, drug);
  if (!conflict) return null;
  const given = reason?.trim() ?? "";
  if (given.length < OVERRIDE_REASON_MIN) throw allergyConflict(conflict);
  return { conflict, reason: given };
}
