import { describe, expect, it } from "vitest";
import { currentWeight } from "./weight";

const oct7 = new Date("2026-10-07T08:00:00.000Z");
const sep1 = new Date("2026-09-01T08:00:00.000Z");

describe("currentWeight", () => {
  it("takes the visit's weight when the card has none (the vet's 4,2 kg)", () => {
    expect(
      currentWeight({ weightKg: null, weightRecordedAt: null }, { weightKg: 4.2, visitedAt: oct7 }),
    ).toEqual({ kg: 4.2, at: oct7, source: "visit" });
  });

  it("prefers a dated visit over an undated card weight", () => {
    expect(
      currentWeight({ weightKg: 3.9, weightRecordedAt: null }, { weightKg: 4.2, visitedAt: sep1 }),
    ).toMatchObject({ kg: 4.2, source: "visit" });
  });

  it("keeps a card weight entered after the last weighed visit", () => {
    expect(
      currentWeight({ weightKg: 4.5, weightRecordedAt: oct7 }, { weightKg: 4.2, visitedAt: sep1 }),
    ).toEqual({ kg: 4.5, at: oct7, source: "pet" });
  });

  it("falls back to the card when no visit was weighed", () => {
    expect(currentWeight({ weightKg: 4.5, weightRecordedAt: null }, null)).toEqual({
      kg: 4.5,
      at: null,
      source: "pet",
    });
    expect(
      currentWeight({ weightKg: 4.5, weightRecordedAt: null }, { weightKg: null, visitedAt: oct7 }),
    ).toMatchObject({ source: "pet" });
  });

  it("says nothing when nobody weighed the animal", () => {
    expect(currentWeight({ weightKg: null, weightRecordedAt: null }, null)).toBeNull();
  });
});
