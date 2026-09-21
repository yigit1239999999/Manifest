import { describe, expect, it } from "vitest";
import { addInterval, intervalOf } from "./vaccination-interval";

describe("addInterval", () => {
  it("keeps the day of the month a year later", () => {
    expect(addInterval("2026-03-14", { unit: "year", value: 1 })).toBe(
      "2027-03-14",
    );
  });

  it("crosses a leap day without moving the date", () => {
    // 2028 is a leap year, so a timestamp-based +365 days would land on
    // 13 March and the reminder would go out a day early, every fourth year.
    expect(addInterval("2027-03-14", { unit: "year", value: 1 })).toBe(
      "2028-03-14",
    );
  });

  it("clamps to the last day of a shorter month", () => {
    expect(addInterval("2026-01-31", { unit: "month", value: 1 })).toBe(
      "2026-02-28",
    );
  });

  it("counts weeks as weeks", () => {
    expect(addInterval("2026-03-14", { unit: "week", value: 3 })).toBe(
      "2026-04-04",
    );
  });

  it("returns nothing for a date it cannot read, rather than a wrong one", () => {
    expect(addInterval("", { unit: "year", value: 1 })).toBe("");
  });
});

describe("intervalOf round-trips with addInterval", () => {
  // The two halves have to agree: whatever the clinic's history is read as,
  // applying it again has to produce a gap that reads back the same way.
  for (const days of [7, 21, 30, 90, 180, 365, 730]) {
    it(`${days} days`, () => {
      const interval = intervalOf(days);
      expect(interval).not.toBeNull();
      const then = addInterval("2026-03-14", interval!);
      const gap = Math.round(
        (Date.parse(then) - Date.parse("2026-03-14")) / 86_400_000,
      );
      expect(intervalOf(gap)).toEqual(interval);
    });
  }
});
