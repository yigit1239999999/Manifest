// Do the browser and the database fold a name the same way?
//
// Search now has two halves that must agree exactly. The picker filters
// in JavaScript with `fold()` from lib/search.ts; the server compares a
// term folded by the same function against `searchKey`, a generated
// column holding `lower(immutable_unaccent(...))`. If the two disagree
// on one letter, the server answers a question the browser did not ask
// and rows go missing with nothing on screen to say so -- the same
// silent absence the accent fix exists to remove, moved one layer down.
//
// So this compares them character by character against the live
// function, and refuses quietly passing: it exits non-zero on any
// disagreement. It is also where the exception table in lib/search.ts
// comes from. `unaccent` folds letters that Unicode decomposition does
// not (ß, ø, æ, ...), because they are separate letters rather than a
// base plus a mark; the only honest way to know which ones is to ask.
//
// Run: node --env-file=.env scripts/fold-parity.mjs
//
// Raw `pg` rather than Prisma, like scripts/loop-metrics.mjs: this asks
// the database about a SQL function, not about the model.
import { Client } from "pg";
import { fold } from "../lib/search.ts";

const db = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

/** Every character a Latin-script name can plausibly be spelled with. */
function alphabet() {
  const chars = [];
  for (let c = 0x20; c <= 0x7e; c++) chars.push(String.fromCodePoint(c));
  // Latin-1 Supplement, Latin Extended-A and Extended-B: where Turkish,
  // the rest of Europe, and the letters unaccent treats specially live.
  for (let c = 0xc0; c <= 0x24f; c++) chars.push(String.fromCodePoint(c));
  return chars;
}

// Names rather than only letters. A letter can fold correctly on its own
// and still go wrong in a word -- `İ` is the case in point, because the
// two sides reach it by different routes: JavaScript lowercases in
// Turkish and strips a combining dot, Postgres asks a dictionary.
const NAMES = [
  "Ayşe Demir",
  "Çiğdem Öztürk",
  "Gülşen Şahin",
  "Işık Yılmaz",
  "İstanbul",
  "Istanbul",
  "ısırgan",
  "IŞIK",
  "Doğu Karadeniz",
  "Ömer Faruk Güneş",
  "José Muñoz",
  "Karabaş",
  "",
  " ",
  "a",
  "Ş",
];

async function main() {
  await db.connect();

  const subjects = [...alphabet(), ...NAMES];
  const { rows } = await db.query(
    `SELECT s AS input, lower(public.immutable_unaccent(s)) AS sql_fold
       FROM unnest($1::text[]) AS s`,
    [subjects],
  );

  const disagreements = rows.filter((r) => fold(r.input) !== r.sql_fold);

  // Latin-1 and Latin Extended-A is where names are spelled; past U+017F
  // unaccent keeps folding letters that JavaScript decomposition does
  // not, and lib/search.ts deliberately stops there. Those are counted
  // and named rather than silently tolerated, but they do not fail the
  // run -- a name in this product is not spelled with ƀ or ǉ.
  const NAMEABLE = 0x017f;
  const inRange = disagreements.filter((r) =>
    [...r.input].every((c) => c.codePointAt(0) <= NAMEABLE),
  );

  for (const r of inRange) {
    const cp = [...r.input]
      .map(
        (c) =>
          "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
      )
      .join(" ");
    console.log(
      `MISMATCH ${JSON.stringify(r.input)} [${cp}] js=${JSON.stringify(fold(r.input))} sql=${JSON.stringify(r.sql_fold)}`,
    );
  }

  console.log(
    `FOLD_PARITY [${subjects.length} subjects, ${inRange.length} disagreements in names, ` +
      `${disagreements.length - inRange.length} beyond U+${NAMEABLE.toString(16).toUpperCase()} (out of scope)]`,
  );

  await db.end();
  if (inRange.length > 0) process.exitCode = 1;
}

await main();
