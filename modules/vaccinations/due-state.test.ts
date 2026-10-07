import { describe, expect, it } from "vitest";
import { dueState } from "./due-state";

const now = new Date("2026-10-07T09:00:00.000Z");
const row = (over: Partial<Parameters<typeof dueState>[0]> = {}) => ({
  nextDueAt: null,
  dueDismissedAt: null,
  supersededById: null,
  ...over,
});

describe("dueState", () => {
  it("counts the days a date has gone by", () => {
    expect(dueState(row({ nextDueAt: new Date("2026-09-27T09:00:00.000Z") }), now)).toEqual({
      kind: "overdue",
      days: 10,
    });
    expect(dueState(row({ nextDueAt: new Date("2026-10-07T08:00:00.000Z") }), now)).toEqual({
      kind: "overdue",
      days: 0,
    });
  });

  it("is quiet for a future date, a closed row, or none", () => {
    expect(dueState(row({ nextDueAt: new Date("2026-11-01") }), now).kind).toBe("none");
    expect(
      dueState(row({ nextDueAt: new Date("2026-09-01"), dueDismissedAt: new Date() }), now).kind,
    ).toBe("none");
    expect(dueState(row(), now).kind).toBe("none");
  });

  it("says a later dose answered it, rather than calling it overdue", () => {
    expect(
      dueState(row({ nextDueAt: new Date("2026-09-01"), supersededById: "v-2" }), now),
    ).toEqual({ kind: "superseded" });
  });
});
