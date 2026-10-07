import { describe, expect, it } from "vitest";
import { fold, matches } from "./search";

// `fold` has a second reader now, and it is a database.
//
// The picker filters with it in the browser; the server folds a search
// term with it and compares that against `searchKey`, a column Postgres
// generates with `lower(immutable_unaccent(...))`. Two implementations
// of one idea, and a disagreement about a single letter means rows go
// missing with nothing on screen to say why.
//
// `scripts/fold-parity.mjs` is what proves the two agree, character by
// character, against the live function -- it needs a database, so it is
// a script rather than a test. What is pinned here is the JavaScript
// side of that agreement: if someone edits this file, the parity script
// has to be run again, and these cases say what it measured.

describe("folding a name for comparison", () => {
  it("folds the letters a Turkish keyboard has and an English one does not", () => {
    expect(fold("Ayşe Demir")).toBe("ayse demir");
    expect(fold("Çiğdem Öztürk")).toBe("cigdem ozturk");
    expect(fold("Gülşen Şahin")).toBe("gulsen sahin");
  });

  it("brings I, İ, i and ı to the same letter", () => {
    // The two sides reach this by different routes -- JavaScript
    // lowercases in Turkish and strips a combining dot, Postgres asks a
    // dictionary -- so agreeing here is the case worth naming.
    expect(fold("Işık")).toBe("isik");
    expect(fold("İstanbul")).toBe("istanbul");
    expect(fold("Istanbul")).toBe("istanbul");
    expect(fold("ısırgan")).toBe("isirgan");
  });

  it("folds the letters decomposition cannot", () => {
    // Separate letters rather than a base plus a mark, so NFD leaves
    // them alone and unaccent does not. Measured, not guessed: `ĸ`
    // reads like a k and folds to q, which is exactly the kind of
    // assumption that would have put a disagreement in the table meant
    // to remove them.
    expect(fold("ĸ")).toBe("q");
    expect(fold("Straße")).toBe("strasse");
    expect(fold("Sørensen")).toBe("sorensen");
    expect(fold("Æsir")).toBe("aesir");
  });

  it("leaves what it does not fold alone", () => {
    // A fold that strips too much is the same silence from the other
    // end: every row matches and the picker stops narrowing anything.
    expect(fold("Mehmet Kaya")).toBe("mehmet kaya");
    expect(fold("")).toBe("");
    expect(fold("0532 123 45 67")).toBe("0532 123 45 67");
  });

  it("matches on both sides folded, and lets an empty query through", () => {
    expect(matches("Ayşe Demir", "ayse")).toBe(true);
    expect(matches("Ayse Demir", "Ayşe")).toBe(true);
    expect(matches("Mehmet Kaya", "ayse")).toBe(false);
    // An empty query is not a search; a picker showing nothing until
    // something is typed is a picker that looks broken.
    expect(matches("Ayşe Demir", "")).toBe(true);
  });
});
