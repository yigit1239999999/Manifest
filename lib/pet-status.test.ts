import { describe, expect, it } from "vitest";
import { isAfterDeath } from "./pet-status";

describe("isAfterDeath", () => {
  const died = new Date("2026-10-06T21:00:00.000Z"); // 7 Oct, Istanbul midnight

  it("allows the day itself: a visit during which the animal died", () => {
    expect(isAfterDeath({ deceased: true, deceasedAt: died }, new Date("2026-10-07T15:00:00.000Z"))).toBe(false);
  });

  it("refuses anything after that day", () => {
    expect(isAfterDeath({ deceased: true, deceasedAt: died }, new Date("2026-10-07T21:00:00.000Z"))).toBe(true);
  });

  it("refuses everything new when nobody recorded the day", () => {
    expect(isAfterDeath({ deceased: true, deceasedAt: null }, new Date("2020-01-01"))).toBe(true);
  });

  it("has nothing to say about a living animal", () => {
    expect(isAfterDeath({ deceased: false, deceasedAt: null }, new Date())).toBe(false);
  });
});
