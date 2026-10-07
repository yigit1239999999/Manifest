import { describe, expect, it } from "vitest";
import { supersessionChanges } from "./supersede";
import { clinicVaccineList, normalizeVaccineSettings } from "./catalogue";

const DOG = clinicVaccineList("DOG", normalizeVaccineSettings(undefined));

const row = (id: string, name: string, at: string, supersededById: string | null = null) => ({
  id,
  name,
  administeredAt: new Date(at),
  supersededById,
});

describe("supersessionChanges", () => {
  it("lets a new dose answer the older one, Lyme again in October", () => {
    const changes = supersessionChanges(
      [row("old", "Lyme", "2025-10-07"), row("new", "Lyme", "2026-10-07")],
      DOG,
    );
    expect(Object.fromEntries(changes)).toEqual({ old: "new" });
  });

  it("matches through catalogue aliases and how people write a vaccine", () => {
    const changes = supersessionChanges(
      [
        row("a", "Karma aşı", "2024-09-01"),
        row("b", "Karma (DHPPi)", "2025-09-01"),
        row("c", "DHPPi", "2026-09-01"),
      ],
      DOG,
    );
    expect(Object.fromEntries(changes)).toEqual({ a: "b", b: "c" });
  });

  it("points each row at the next dose, not the newest", () => {
    // So removing the newest re-opens only the one before it, through
    // the foreign key, with nothing recomputed.
    const changes = supersessionChanges(
      [row("c", "Kuduz", "2026-01-01"), row("a", "kuduz", "2024-01-01"), row("b", "KUDUZ", "2025-01-01")],
      DOG,
    );
    expect(Object.fromEntries(changes)).toEqual({ a: "b", b: "c" });
  });

  it("keeps different vaccines apart", () => {
    const changes = supersessionChanges(
      [row("k", "Kuduz", "2025-01-01"), row("m", "Karma", "2026-01-01")],
      DOG,
    );
    expect(changes.size).toBe(0);
  });

  it("re-opens a row whose answer has gone, and leaves settled ones alone", () => {
    const changes = supersessionChanges(
      [row("a", "Lyme", "2024-01-01", "b"), row("b", "Lyme", "2025-01-01", "gone")],
      DOG,
    );
    expect(Object.fromEntries(changes)).toEqual({ b: null });
  });
});
