/**
 * One comparable form of a name, so that typing it without a Turkish
 * keyboard still finds it: "Ayse" finds "Ayşe", "Cigdem" finds "Çiğdem".
 *
 * This lives here, and not in the picker it was written for, because the
 * database now folds the same way: `clients.searchKey` and
 * `pets.searchKey` are generated columns holding
 * `lower(immutable_unaccent(...))`, and the term compared against them
 * is folded by this function. Two implementations of the same idea that
 * disagree on one letter produce a search that quietly misses rows, so
 * `scripts/fold-parity.mjs` compares the two character by character
 * against the live function.
 */

// Combining marks left behind by NFD. Not `\p{Diacritic}`, which needs a
// newer target than this file is compiled with.
const MARKS = /[̀-ͯ]/g;

/**
 * Letters `unaccent` folds that decomposition does not.
 *
 * NFD only helps where a character is a base letter plus a mark. These
 * are separate letters in Unicode's eyes, and Postgres's unaccent
 * dictionary maps them anyway -- so without this table the browser and
 * the database would disagree on exactly these characters, which is the
 * failure mode this whole pair exists to avoid. The list is not a guess:
 * `scripts/fold-parity.mjs` walked printable ASCII and every codepoint
 * from U+00C0 to U+024F against the live SQL function, and these are the
 * ones that came back different.
 *
 * `ı` is the one that matters here. It is a letter, not an `i` wearing a
 * mark, so NFD leaves it alone -- and it was the single letter the old
 * fold handled, back when it handled nothing else.
 *
 * `ĸ` is why the list is measured rather than reasoned about: it reads
 * like a `k` and unaccent folds it to `q`. A plausible guess would have
 * put a disagreement into the table meant to remove them.
 *
 * The table covers Latin-1 and Latin Extended-A, up to U+017F. Beyond
 * that unaccent keeps folding (ƀ to b, ǉ to lj) and this does not; those
 * are IPA and African orthography letters that no name in this product
 * is spelled with. The parity script counts them and prints the count,
 * so the boundary stays a decision somebody made rather than a gap
 * nobody noticed.
 */
const LETTERS: Record<string, string> = {
  ı: "i",
  ß: "ss",
  æ: "ae",
  ø: "o",
  œ: "oe",
  ð: "d",
  þ: "th",
  đ: "d",
  ħ: "h",
  ĳ: "ij",
  ĸ: "q",
  ŀ: "l",
  ł: "l",
  ŉ: "'n",
  ŋ: "n",
  ŧ: "t",
  ſ: "s",
  // Not letters, and still worth folding: unaccent maps them, and a
  // breed reads "Labrador × Golden" often enough for the two sides to
  // have to agree about it.
  "×": "*",
  "÷": "/",
};

const LETTER_RE = new RegExp(`[${Object.keys(LETTERS).join("")}]`, "g");

export function fold(s: string): string {
  return (
    s
      // Turkish first, and only here: it is the one locale where
      // lowercasing changes which letter you get. `I` becomes `ı` (mapped
      // below) and `İ` becomes `i` plus a combining dot (stripped below),
      // so `I`, `İ`, `i` and `ı` all arrive at `i`.
      .toLocaleLowerCase("tr")
      .replace(LETTER_RE, (c) => LETTERS[c])
      .normalize("NFD")
      .replace(MARKS, "")
  );
}

/**
 * True when `label` contains `query`, both folded. The comparison has to
 * fold both sides: a folded query against an unfolded label finds
 * nothing the moment either one carries an accent.
 */
export function matches(label: string, query: string): boolean {
  if (!query) return true;
  return fold(label).includes(fold(query));
}
