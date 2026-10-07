import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A heading written as a bare English string.
//
// `<CardTitle>Payments</CardTitle>` sat on the invoice detail page of a
// Turkish-first product, and the reason it lasted is the interesting
// part: there was no translation key, so nothing that audits
// translation keys could see it. Every tool we have for this asks "is
// this key present in both files?" — and a string with no key is
// invisible to all of them. ux's sentence: a string with no key does
// not show up in a scan for missing translations, because there is no
// key to look for.
//
// So this scans the other direction. Not "is every key translated" but
// "is every heading a key at all".
//
// SCOPE, stated because a scan that cannot name its own limits is the
// next thing to go quietly green:
//
//   - Only the components in TITLES below, and only their direct text.
//     A bare string inside a `<p>`, a button label, a `title=`
//     attribute or an `aria-label` is not checked here.
//   - Only ASCII capitalised words, which is what an untranslated
//     English string looks like. A Turkish string hard-coded in a
//     component would pass this and is just as wrong.
//   - Nothing about whether an existing key has both languages. That
//     is a different scan and it already exists.
//
// It counts what it read, for the reason dev established in
// `picker-refusals`: a scan that cannot find its subject passes
// forever.

const TITLES = ["CardTitle", "PageHeader", "DialogTitle", "CardDescription"];

const appDir = join(process.cwd(), "app");
const componentsDir = join(process.cwd(), "components");

function sources(dir: string, out: { path: string; text: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test."))
      out.push({ path, text: readFileSync(path, "utf8") });
  }
  return out;
}

const files = [...sources(appDir), ...sources(componentsDir)];

describe("headings come from the message files", () => {
  it("reads the tree it claims to read", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds the components it is looking for", () => {
    // If `CardTitle` is renamed, the scan below matches nothing and
    // passes on every file forever. This is the tripwire for that.
    const seen = TITLES.filter((tag) =>
      files.some(({ text }) => text.includes(`<${tag}`)),
    );
    expect(seen).toEqual(TITLES);
  });

  it("no heading is a bare English string", () => {
    const offenders: string[] = [];
    for (const { path, text } of files) {
      for (const tag of TITLES) {
        // The opening tag, then text that starts with a capital and a
        // lowercase letter before any `{`. `{t("…")}` does not match,
        // and neither does a heading built from a variable.
        const bare = new RegExp(
          `<${tag}(?:\\s[^>]*)?>\\s*([A-Z][a-z][^<{]*)<`,
          "g",
        );
        for (const found of text.matchAll(bare)) {
          offenders.push(
            `${path.slice(process.cwd().length + 1)}: <${tag}>${found[1].trim()}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
