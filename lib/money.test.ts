import { describe, expect, it } from "vitest";
import { centsToInputValue, parseMoneyToCents } from "./money";

const tr = (v: string) => parseMoneyToCents(v, "tr");
const en = (v: string) => parseMoneyToCents(v, "en");

describe("parseMoneyToCents", () => {
  it("reads a whole amount as units", () => {
    expect(tr("500")).toBe(50_000);
    expect(en("500")).toBe(50_000);
    expect(tr("0")).toBe(0);
  });

  it("reads the locale's decimal separator", () => {
    expect(tr("12,50")).toBe(1250);
    expect(tr("12,5")).toBe(1250);
    expect(en("12.50")).toBe(1250);
    expect(en("12.5")).toBe(1250);
  });

  it("reads the locale's thousands separator", () => {
    expect(tr("1.234,56")).toBe(123_456);
    expect(tr("12.345")).toBe(1_234_500);
    expect(tr("1.234.567,89")).toBe(123_456_789);
    expect(en("1,234.56")).toBe(123_456);
    expect(en("12,345")).toBe(1_234_500);
  });

  // The regression pm found: read without a locale, a Turkish "10,999" was
  // taken for ten thousand nine hundred and ninety-nine lira and a 250 lira
  // invoice was paid off in one keystroke. In Turkish that text is 10 lira
  // and 99,9 kuruş — sub-cent, which is a typo and must be refused.
  it("refuses sub-cent precision in the locale that writes it", () => {
    expect(tr("10,999")).toBeNull();
    expect(tr("12,345")).toBeNull();
    expect(tr("1,2345")).toBeNull();
    expect(en("10.999")).toBeNull();
    expect(en("12.345")).toBeNull();
  });

  // The same two strings, read in the other locale, are thousands. This pair
  // is the whole reason the function takes a locale; if it is ever made
  // locale-blind again, one of these two lines has to fail.
  it("reads the same text differently in each locale, on purpose", () => {
    expect(tr("12.345")).toBe(1_234_500);
    expect(en("12.345")).toBeNull();
    expect(en("12,345")).toBe(1_234_500);
    expect(tr("12,345")).toBeNull();
  });

  it("refuses the other locale's notation rather than guessing at it", () => {
    // "1,234.56" in Turkish would have to read "," as decimal and then find
    // digits grouped after it. There is no honest reading, so it is an error
    // the user can see, not a number we invented.
    expect(tr("1,234.56")).toBeNull();
    expect(en("1.234,56")).toBeNull();
  });

  it("ignores spaces used as grouping", () => {
    expect(tr("1 234,56")).toBe(123_456);
    expect(en("1 234.56")).toBe(123_456);
  });

  it("rejects instead of guessing", () => {
    expect(tr("")).toBeNull();
    expect(tr("abc")).toBeNull();
    expect(tr("-5")).toBeNull();
    expect(tr("1.2.3")).toBeNull(); // broken grouping
    expect(tr("12,")).toBeNull();
    expect(tr(",")).toBeNull();
    expect(tr("0.001")).toBeNull();
  });
});

describe("centsToInputValue", () => {
  it("writes the amount the way the locale writes it", () => {
    expect(centsToInputValue("tr", 123_456)).toBe("1.234,56");
    expect(centsToInputValue("en", 123_456)).toBe("1,234.56");
  });

  // What an input shows must be what the parser reads back, or an edit that
  // changes nothing still changes the stored amount.
  it("round-trips through the parser in both locales", () => {
    for (const cents of [0, 5, 50, 50_000, 123_456, 100_000_000]) {
      expect(parseMoneyToCents(centsToInputValue("tr", cents), "tr")).toBe(cents);
      expect(parseMoneyToCents(centsToInputValue("en", cents), "en")).toBe(cents);
    }
  });
});
