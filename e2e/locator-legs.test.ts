import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every alternative in a bilingual locator has to be able to match
 * something the product says.
 *
 * The suite runs in English. When a locator is written as
 * `/first name|^ad$/i`, the English half matches, the test passes, and
 * the Turkish half is never tried -- so a Turkish alternative can be
 * wrong from the day it is written and stay green for months. The
 * pattern looks like it covers two languages; it covers one, and says
 * nothing about the other.
 *
 * Eight of them were dead when this was written, and seven had the same
 * cause, which is worth knowing before writing the eighth:
 *
 *   "İ".toLowerCase() is not "i". It is "i" followed by U+0307, a
 *   combining dot. And JavaScript's `/i` flag does not fold U+0130 onto
 *   U+0069 either, so BOTH of these are false:
 *
 *       /^isim$/i.test("İsim")    // the label in the product
 *       /^i̇sim$/i.test("İsim")    // what pasting a lowercased label gives
 *
 * So a Turkish label beginning with "İ" cannot be matched by anything
 * written with a lowercase "i". Write `[İi]` -- or better, find the
 * control by its role and key rather than by its words.
 *
 * WHAT THIS DOES NOT CHECK. It reads what the locator COULD match, not
 * what it does match on screen: a leg that hits some other string in
 * the catalogue passes here and can still be pointed at the wrong
 * control. That is a different test and this one does not pretend to
 * be it.
 *
 * WHY ONLY MULTI-LEG PATTERNS. A single-leg regex is usually test data
 * or a URL -- `getByText("Limon")`, `/\/clients\/(?!new)[\w-]+$/` --
 * and none of that belongs in the message files. Requiring those to
 * match would make this a false-alarm machine: measured, 59 flags
 * instead of 7. The `|` is the signal that a leg is standing in for a
 * language.
 *
 * AND WHY TEMPLATES ARE HANDLED SEPARATELY. Some sentences are built
 * at runtime -- "{field} gerekli." -- so `tür gerekli` appears in no
 * file and is still on screen. team-lead's first scan reported five of
 * those as dead before checking; the scan's universe was literals and
 * interpolation was outside it. A leg is therefore also accepted when
 * it contains a template's fixed part.
 */

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

/** Every string in a catalogue, flattened. Both, when none is named. */
function catalogueStrings(locale?: "tr" | "en"): string[] {
  const out: string[] = [];
  for (const name of locale ? [locale] : ["tr", "en"]) {
    const json = JSON.parse(
      readFileSync(`${projectRoot}messages/${name}.json`, "utf8"),
    );
    (function walk(node: unknown) {
      if (typeof node === "string") out.push(node);
      else if (node && typeof node === "object") {
        for (const value of Object.values(node)) walk(value);
      }
    })(json);
  }
  return out;
}

/**
 * The parts of a runtime-assembled sentence that survive whatever is
 * put in the hole. Trailing punctuation comes off because a locator
 * names the words, not the full stop.
 */
function templateFragments(strings: string[]): string[] {
  const out = new Set<string>();
  for (const value of strings) {
    if (!/\{[^}]+\}/.test(value)) continue;
    for (const part of value.split(/\{[^}]+\}/)) {
      const trimmed = part.trim().replace(/[.!?:,]+$/, "");
      if (trimmed.length >= 4) out.add(trimmed);
    }
  }
  return [...out];
}

/** Top-level `|` only: `(\?|$)` is one leg, not two. */
function splitAlternatives(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inClass = false;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      current += c + body[++i];
      continue;
    }
    if (inClass) {
      current += c;
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      current += c;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "|" && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  out.push(current);
  return out;
}

/** Locators that name what the reader sees. `toHaveURL` is not one. */
const NAME_LOCATOR =
  /(getByLabel|getByText|getByPlaceholder|getByRole|hasText|name:)/;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asPlainText = (leg: string) => leg.replace(/[\\^$]|\\b/g, "").trim();

function deadLegs(): string[] {
  const strings = catalogueStrings();
  const fragments = templateFragments(strings);
  const dead: string[] = [];

  for (const file of readdirSync(`${projectRoot}e2e`)) {
    if (!file.endsWith(".spec.ts")) continue;
    const lines = readFileSync(`${projectRoot}e2e/${file}`, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.trim().startsWith("//") || !NAME_LOCATOR.test(line)) return;
      for (const match of line.matchAll(
        /\/((?:[^/\\\n[]|\\.|\[[^\]]*\])+)\/([a-z]*)/g,
      )) {
        const legs = splitAlternatives(match[1]);
        if (legs.length < 2) continue;
        for (const leg of legs) {
          let pattern: RegExp;
          try {
            pattern = new RegExp(leg, match[2]);
          } catch {
            continue;
          }
          if (strings.some((value) => pattern.test(value))) continue;
          const text = asPlainText(leg);
          const viaTemplate = fragments.some((fragment) =>
            new RegExp(escapeRegExp(fragment), "i").test(text),
          );
          if (!viaTemplate) dead.push(`${file}:${index + 1}  ${leg}`);
        }
      }
    });
  }
  return dead;
}

/**
 * A label locator has to be able to find its field in BOTH languages.
 *
 * This is the rule `a bilingual locator` cannot state. That one checks the
 * legs of a multi-leg pattern; `/^email$/i` has one leg, it matched the
 * English catalogue, and it passed for months -- while the Turkish label
 * said "E-posta" and the suite could not be run in Turkish at all. The
 * product's default language is Turkish (`i18n/request.ts`), so the suite
 * was only ever testing the deviation.
 *
 * WHY ONLY `getByLabel`. Measured on the tree this landed with: 126 label
 * patterns, 0 violations -- so this rule starts with no exemptions. The
 * same rule over every name locator flags 40 of 291, nearly all of them
 * test data ("Ayse Yilmaz", "11:30", "Rabies") that belongs in no
 * catalogue. A rule that ships with forty exemptions is read as "these are
 * allowed", and the exemptions outlive the reason for them. A label names
 * a field the product drew; that is what makes this one checkable.
 *
 * PLACEHOLDERS COME OUT FIRST, and that is not tidying. `/owner/i` was
 * counted as bilingual for one measurement because `tr.json` contains
 * "Yeni hayvan aç, sahibi: {owner}" -- the ICU argument NAME, which no
 * vet ever sees. A scan whose universe includes text that is never on
 * screen is wrong by exactly that much.
 */
function monolingualLabels(): string[] {
  const strip = (value: string) => value.replace(/\{[^}]*\}/g, " ");
  const tr = catalogueStrings("tr").map(strip);
  const en = catalogueStrings("en").map(strip);
  const found: string[] = [];

  for (const file of readdirSync(`${projectRoot}e2e`)) {
    if (!file.endsWith(".spec.ts")) continue;
    const lines = readFileSync(`${projectRoot}e2e/${file}`, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.trim().startsWith("//")) return;
      for (const match of line.matchAll(
        /getByLabel\(\/((?:[^/\\\n[]|\\.|\[[^\]]*\])+)\/([a-z]*)\)/g,
      )) {
        let pattern: RegExp;
        try {
          pattern = new RegExp(match[1], match[2]);
        } catch {
          continue;
        }
        const inTr = tr.some((value) => pattern.test(value));
        const inEn = en.some((value) => pattern.test(value));
        if (inTr && inEn) continue;
        found.push(
          `${file}:${index + 1}  /${match[1]}/  (tr: ${inTr ? "yes" : "no"}, en: ${inEn ? "yes" : "no"})`,
        );
      }
    });
  }
  return found;
}

describe("a label locator", () => {
  it("can find its field in either language", () => {
    expect(monolingualLabels()).toEqual([]);
  });

  it("would catch one that cannot", () => {
    // Without this the scan could stop finding label locators entirely and
    // keep reporting an empty list -- the trap the rule below names, and
    // the one this file already guards its own scraping against.
    const strip = (value: string) => value.replace(/\{[^}]*\}/g, " ");
    const tr = catalogueStrings("tr").map(strip);
    // The exact pattern that shipped and stayed green for months.
    expect(tr.some((value) => /^email$/i.test(value))).toBe(false);
    // And the placeholder case that made one measurement of this wrong.
    expect(tr.some((value) => /owner/i.test(value))).toBe(false);
  });
});

describe("a bilingual locator", () => {
  it("has no leg that cannot match anything the product says", () => {
    expect(deadLegs()).toEqual([]);
  });

  it("knows what a dead leg looks like", () => {
    // Without this the rule could be quietly inverted -- or its regex
    // scraping could stop finding locators at all -- and it would keep
    // reporting an empty list either way. The three below are the
    // shapes that were actually in the tree.
    const strings = ["İsim", "First name"];
    const fragments = templateFragments(["{field} gerekli."]);
    const hits = (leg: string) =>
      strings.some((value) => new RegExp(leg, "i").test(value)) ||
      fragments.some((fragment) =>
        new RegExp(escapeRegExp(fragment), "i").test(asPlainText(leg)),
      );

    expect(hits("^isim$")).toBe(false); // İ is not i
    expect(hits("^i̇sim$")).toBe(false); // a lowercased "İ"
    expect(hits("^[İi]sim$")).toBe(true); // the fix
    expect(hits("tür gerekli")).toBe(true); // assembled at runtime
  });

  it("reads only the patterns that stand for a language", () => {
    // Single-leg regexes are test data and URLs. Measured on the tree
    // this was written against: requiring those to match turned 7 real
    // findings into 59.
    expect(splitAlternatives("\\/visits\\/(?!new)[^/?]+(\\?|$)")).toHaveLength(1);
    expect(splitAlternatives("first name|^ad$")).toHaveLength(2);
  });
});
