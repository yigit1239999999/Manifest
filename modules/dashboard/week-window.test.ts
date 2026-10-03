import { describe, expect, it } from "vitest";
import { firstWeekBucketStart } from "./queries";

// The panel draws twelve weekly columns and one of them has to be the week
// the vet is standing in. It was not: the window was a whole twelve weeks
// back rather than eleven, so the series ran -12..-1 and today's week fell
// off the end. What made it worth a test rather than a fix is that nothing
// on screen tells the two apart except the label under the last column --
// twelve bars either way, the footnote promising "the period in progress"
// either way.
//
// The dates below are written out rather than derived, because deriving
// them would repeat the arithmetic under test and agree with it whichever
// way it was wrong.

/** Local midnight, so a UTC offset cannot move a date into another week. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("the window the twelve weekly columns cover", () => {
  it("ends on the week we are in, not the one that just finished", () => {
    // Monday 21 September 2026, the day this was found.
    const start = firstWeekBucketStart(at(2026, 9, 21), 12);

    // Sunday 5 July: eleven weeks back, so the twelfth column is the week
    // beginning Sunday 20 September -- the one containing that Monday.
    expect(start).toEqual(at(2026, 7, 5));
  });

  it("starts on a Sunday even when asked mid-week", () => {
    // Thursday, Friday, Saturday of the same week all answer alike: the
    // column is the week, not the day the page happened to be opened.
    const thursday = firstWeekBucketStart(at(2026, 9, 24), 12);
    const saturday = firstWeekBucketStart(at(2026, 9, 26), 12);

    expect(thursday).toEqual(at(2026, 7, 5));
    expect(saturday).toEqual(at(2026, 7, 5));
  });

  it("treats Sunday as the first day of its own week, not the last", () => {
    // Sunday 20 September is the start of the current week, so the window
    // is the same one Monday the 21st gets -- not a week earlier.
    expect(firstWeekBucketStart(at(2026, 9, 20), 12)).toEqual(at(2026, 7, 5));
  });

  it("counts back one week less than the number of columns", () => {
    // The rule the bug broke, stated on its own: a single column is the
    // current week and nothing before it.
    expect(firstWeekBucketStart(at(2026, 9, 21), 1)).toEqual(at(2026, 9, 20));
    expect(firstWeekBucketStart(at(2026, 9, 21), 2)).toEqual(at(2026, 9, 13));
  });

  it("crosses a year boundary without landing in the wrong year", () => {
    // Monday 4 January 2027: eleven weeks back is the middle of October.
    expect(firstWeekBucketStart(at(2027, 1, 4), 12)).toEqual(at(2026, 10, 18));
  });
});
