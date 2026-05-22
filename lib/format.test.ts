import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firstName,
  formatDate,
  initials,
  petAge,
  sexLabel,
  speciesLabel,
  toDateInput,
} from "@/lib/format";

describe("speciesLabel", () => {
  it("maps known species to friendly labels", () => {
    expect(speciesLabel("DOG")).toBe("Dog");
    expect(speciesLabel("CAT")).toBe("Cat");
    expect(speciesLabel("REPTILE")).toBe("Reptile");
  });

  it("falls back to the raw value for unknown species", () => {
    expect(speciesLabel("DRAGON")).toBe("DRAGON");
  });
});

describe("sexLabel", () => {
  it("maps known values", () => {
    expect(sexLabel("MALE")).toBe("Male");
    expect(sexLabel("FEMALE")).toBe("Female");
    expect(sexLabel("UNKNOWN")).toBe("Unknown");
  });

  it("falls back to the raw value", () => {
    expect(sexLabel("OTHER")).toBe("OTHER");
  });
});

describe("initials", () => {
  it("uses the first letter of up to two words", () => {
    expect(initials("Jamie Rivera")).toBe("JR");
    expect(initials("Alex")).toBe("A");
    expect(initials("Dr Alex Morgan")).toBe("DA");
  });

  it("returns a placeholder for empty input", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("firstName", () => {
  it("returns the first word of a name", () => {
    expect(firstName("Alex Morgan")).toBe("Alex");
    expect(firstName("Alex")).toBe("Alex");
  });
});

describe("formatDate", () => {
  it("returns a dash for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats a date in a readable form", () => {
    expect(formatDate(new Date(2026, 4, 22))).toBe("May 22, 2026");
  });
});

describe("toDateInput", () => {
  it("returns an empty string for missing dates", () => {
    expect(toDateInput(null)).toBe("");
    expect(toDateInput(undefined)).toBe("");
  });

  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateInput(new Date("2024-01-15T00:00:00.000Z"))).toBe("2024-01-15");
  });
});

describe("petAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeNow() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T12:00:00.000Z"));
  }

  it("returns null when there is no birth date", () => {
    expect(petAge(null)).toBeNull();
    expect(petAge(undefined)).toBeNull();
  });

  it("returns null for a birth date in the future", () => {
    freezeNow();
    expect(petAge(new Date("2027-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("reports young pets in months", () => {
    freezeNow();
    expect(petAge(new Date("2026-05-10T00:00:00.000Z"))).toBe("Under 1 month");
    expect(petAge(new Date("2026-02-22T00:00:00.000Z"))).toBe("3 mo old");
  });

  it("reports older pets in years", () => {
    freezeNow();
    expect(petAge(new Date("2023-05-22T00:00:00.000Z"))).toBe("3 yr old");
  });
});
