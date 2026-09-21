import { describe, expect, it } from "vitest";
import { centsToInputValue, parseMoneyToCents } from "./money";

describe("parseMoneyToCents", () => {
  it("reads a whole amount as units", () => {
    expect(parseMoneyToCents("500")).toBe(50_000);
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("reads both decimal separators", () => {
    expect(parseMoneyToCents("12.50")).toBe(1250);
    expect(parseMoneyToCents("12,50")).toBe(1250);
    expect(parseMoneyToCents("12,5")).toBe(1250);
  });

  it("reads both thousands notations", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123_456);
    expect(parseMoneyToCents("1,234.56")).toBe(123_456);
    expect(parseMoneyToCents("1.234.567,89")).toBe(123_456_789);
  });

  // A lone separator with three digits after it is a thousands separator in
  // both locales: Turkish writes 1,50 for one and a half, English 1,500 for
  // fifteen hundred. Reading it as a decimal point turned 1.500 TL into 1,50.
  it("treats a lone separator before three digits as thousands", () => {
    expect(parseMoneyToCents("1.500")).toBe(150_000);
    expect(parseMoneyToCents("1,500")).toBe(150_000);
    expect(parseMoneyToCents("12.345")).toBe(1_234_500);
  });

  it("ignores spaces used as grouping", () => {
    expect(parseMoneyToCents("1 234,56")).toBe(123_456);
    expect(parseMoneyToCents("1 234,56")).toBe(123_456);
  });

  it("rejects instead of guessing", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("1.2.3")).toBeNull(); // broken grouping
    expect(parseMoneyToCents("1,23,456")).toBeNull();
    expect(parseMoneyToCents("12.")).toBeNull();
    expect(parseMoneyToCents(",")).toBeNull();
  });

  // Rounding an amount away is a silent edit of someone's money.
  it("rejects sub-cent precision rather than rounding it", () => {
    expect(parseMoneyToCents("1.2345")).toBeNull();
    expect(parseMoneyToCents("1,0055")).toBeNull();
    expect(parseMoneyToCents("0,001")).toBeNull();
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
      expect(parseMoneyToCents(centsToInputValue("tr", cents))).toBe(cents);
      expect(parseMoneyToCents(centsToInputValue("en", cents))).toBe(cents);
    }
  });
});
