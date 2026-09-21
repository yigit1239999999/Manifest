import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Translation files fail quietly. A key present in one language and missing
// from the other does not break the build, does not throw in development, and
// surfaces as a raw key or an English sentence on a Turkish screen — usually
// in front of the user, months later. The rule "add new keys to both files"
// lives in AGENTS.md, which is advice; here it is a gate.

const load = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`./${name}.json`, import.meta.url)), "utf8"),
  ) as Record<string, unknown>;

const tr = load("tr");
const en = load("en");

type Flat = Map<string, string>;

/** Flattens the nested message object into `a.b.c` -> string. */
function flatten(value: unknown, prefix = "", out: Flat = new Map()): Flat {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object") flatten(child, path, out);
    else out.set(path, String(child));
  }
  return out;
}

/**
 * The ICU arguments a message expects, read at the top level only.
 *
 * Shape alone cannot tell an argument from a plural branch body: in
 * `{count, plural, =0 {unused}}` the inner braces delimit a submessage, and
 * `unused` is text, not an argument. So this scans brace depth and records a
 * name only when the placeholder opens at depth zero. No message in this app
 * nests an argument inside a branch; if one ever does, it goes unchecked
 * rather than reported wrongly.
 */
function icuArguments(message: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    if (message[i] === "}") {
      depth -= 1;
      continue;
    }
    if (message[i] !== "{") continue;
    if (depth === 0) {
      const name = /^\{\s*([a-zA-Z_][\w]*)\s*[,}]/.exec(message.slice(i));
      if (name) names.push(name[1]);
    }
    depth += 1;
  }
  return names.sort();
}

const TR = flatten(tr);
const EN = flatten(en);

describe("tr and en stay in step", () => {
  it("defines the same keys in both languages", () => {
    const missingFromEn = [...TR.keys()].filter((k) => !EN.has(k)).sort();
    const missingFromTr = [...EN.keys()].filter((k) => !TR.has(k)).sort();
    expect({ missingFromEn, missingFromTr }).toEqual({
      missingFromEn: [],
      missingFromTr: [],
    });
  });

  it("expects the same ICU arguments for the same key", () => {
    // A translation that drops `{count}` renders a sentence with a hole in it.
    const mismatched = [...TR.keys()]
      .filter((k) => EN.has(k))
      .map((k) => ({ key: k, tr: icuArguments(TR.get(k)!), en: icuArguments(EN.get(k)!) }))
      .filter(({ tr: a, en: b }) => a.join(",") !== b.join(","));
    expect(mismatched).toEqual([]);
  });

  it("leaves no message empty", () => {
    const blank = [...TR.entries(), ...EN.entries()]
      .filter(([, v]) => v.trim() === "")
      .map(([k]) => k);
    expect(blank).toEqual([]);
  });
});

/** Pronouns with no formal reading. See the test that uses it for why. */
const INFORMAL_PRONOUN = /(?:^|[^\p{L}])(sen|senin|sana|seni|sende|senden)(?![\p{L}])/iu;

describe("Turkish house style", () => {
  // These are the wording rules the team wrote down after getting them wrong.
  // Prose rules get forgotten by the next person writing a screen; this file
  // is the version that does not.

  it("uses no em dash", () => {
    // Turkish typography does not use it, and it reads as machine-written.
    // Parentheses or a comma carry the same aside.
    const offenders = [...TR.entries()].filter(([, v]) => v.includes("—"));
    expect(offenders.map(([k]) => k)).toEqual([]);
  });

  it("calls animals 'hayvan', never 'hasta'", () => {
    // A clinic's patient is the animal, but the Turkish word "hasta" reads as
    // a sick human. The one allowed use is the visit type "Hastalık viziti".
    const allowed = new Set(["enum.visitType.SICK_VISIT"]);
    const offenders = [...TR.entries()]
      .filter(([k]) => !allowed.has(k))
      .filter(([, v]) => /\bhasta(?:lar|ya|yı|nın|ları)?\b/i.test(v))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it("writes 'E-posta', not 'Email' or 'E-mail'", () => {
    const offenders = [...TR.entries()]
      .filter(([, v]) => /\b(e-?mail)\b/i.test(v))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it("never addresses the user as 'sen'", () => {
    // Narrow on purpose. Verb suffixes cannot be told apart by regex — the
    // passive "arşivlensin mi?" is perfectly formal and matches any naive
    // "-sin" rule. Second person singular pronouns have no formal reading at
    // all, so they are the part of the rule a test can actually hold.
    const offenders = [...TR.entries()]
      .filter(([, v]) => INFORMAL_PRONOUN.test(v))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });
});

describe("the forbidden page speaks for ten call sites", () => {
  // `error.forbiddenPage.description` is one sentence shown by every
  // permission gate in the app, and it used to say "this section is for
  // administrators only". That was written when the only two gates were
  // /staff and /settings. It is now shown to a vet tech turned away from
  // /visits/new — a page open to vets and receptionists both — where it is
  // simply false, and it teaches them they need to be promoted when the
  // colleague beside them could do it in two seconds. It was already wrong
  // at one call site before the others existed: /audit's gate reads
  // `audit.read`, which VETERINARIAN also holds.
  //
  // The note in `components/ui/forbidden-state.tsx` warned about exactly
  // this, and it did not help: the new gate was added by someone who never
  // read the note. A caveat with nothing checking its condition turns into
  // a lie the moment the condition changes (TEAM.md #16b).
  //
  // What the rule protects: the sentence may not claim who the section
  // belongs to. What it does NOT protect, and cannot: the word list catches
  // today's spelling of that claim, not the claim itself. "Bu bölüm
  // yöneticilere ayrılmıştır" and "reserved for administrators" both pass
  // and say the same untrue thing. That is a review question, and the
  // answer a reviewer needs is this paragraph, not a longer word list —
  // that race is not winnable.
  //
  // Naming a role is fine. "Ask your clinic administrator" says where to go
  // and is true at every call site; "only administrators" says who owns the
  // page and is false at most of them. The banned thing is the claim of
  // ownership, not the word.
  const EXCLUSIVE = /\b(yalnızca|sadece|only)\b/i;

  it("claims no exclusive owner, in either language", () => {
    const offenders = [tr, en]
      .map((source) => flatten(source).get("error.forbiddenPage.description") ?? "")
      .filter((sentence) => EXCLUSIVE.test(sentence));

    expect(offenders).toEqual([]);
  });

  it("would catch the sentence it replaced", () => {
    expect(EXCLUSIVE.test("Bu bölüm yalnızca yöneticiler içindir.")).toBe(true);
    expect(EXCLUSIVE.test("This section is for administrators only.")).toBe(true);
    expect(EXCLUSIVE.test("Bu bölüm rolünüze açık değil.")).toBe(false);
  });
});

describe("the style rules have teeth", () => {
  // A rule that cannot fail is decoration. Each fixture is the exact mistake
  // the rule above is there to catch.
  const has = (re: RegExp, s: string) => re.test(s);

  it("reads a plural branch body as text, not as an argument", () => {
    // The exact pair that made a naive regex report a false mismatch:
    // `unused` is ASCII and looked like an argument, `kullanılmıyor` is not.
    expect(
      icuArguments("{count, plural, =0 {unused} one {1 pet} other {# pets}}"),
    ).toEqual(["count"]);
    expect(
      icuArguments("{count, plural, =0 {kullanılmıyor} other {# hayvan}}"),
    ).toEqual(["count"]);
  });

  it("would catch a translation that dropped an argument", () => {
    expect(icuArguments("{field} gerekli.")).toEqual(["field"]);
    expect(icuArguments("Bu alan gerekli.")).toEqual([]);
  });

  it("would catch an em dash", () => {
    expect("Kayıtlar — vizitler — burada.".includes("—")).toBe(true);
  });

  it("would catch 'hasta' used for an animal", () => {
    expect(has(/\bhasta(?:lar|ya|yı|nın|ları)?\b/i, "Bu hastanın kaydı")).toBe(true);
    expect(has(/\bhasta(?:lar|ya|yı|nın|ları)?\b/i, "Bu hayvanın kaydı")).toBe(false);
  });

  it("would catch 'Email'", () => {
    expect(has(/\b(e-?mail)\b/i, "Email adresi")).toBe(true);
    expect(has(/\b(e-?mail)\b/i, "E-posta adresi")).toBe(false);
  });

  it("would catch 'sen'", () => {
    expect(INFORMAL_PRONOUN.test("Senin kliniğin")).toBe(true);
    expect(INFORMAL_PRONOUN.test("Kliniğiniz")).toBe(false);
    // And does not fire on the passive voice, which is formal Turkish.
    expect(INFORMAL_PRONOUN.test("Bu hayvan arşivlensin mi?")).toBe(false);
  });
});
