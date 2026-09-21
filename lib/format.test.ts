import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dayKey,
  firstName,
  formatDate,
  formatDuration,
  formatMoney,
  formatTime,
  relativeTime,
  initials,
  petAge,
  sexLabel,
  speciesLabel,
  toDateInput,
  toDateTimeInput,
  wallTimeToInstant,
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
    expect(formatDate("en", null)).toBe("-");
    expect(formatDate("tr", undefined)).toBe("-");
  });

  it("formats a date in a readable form", () => {
    expect(formatDate("en", new Date(2026, 4, 22))).toBe("May 22, 2026");
  });

  it("formats Turkish dates in Turkish", () => {
    expect(formatDate("tr", new Date(2026, 4, 22))).toBe("22 May 2026");
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
    expect(petAge("en", null)).toBeNull();
    expect(petAge("tr", undefined)).toBeNull();
  });

  it("returns null for a birth date in the future", () => {
    freezeNow();
    expect(petAge("en", new Date("2027-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("reports young pets in months", () => {
    freezeNow();
    expect(petAge("en", new Date("2026-05-10T00:00:00.000Z"))).toBe("Under 1 month");
    expect(petAge("en", new Date("2026-02-22T00:00:00.000Z"))).toBe("3 mo");
    expect(petAge("tr", new Date("2026-02-22T00:00:00.000Z"))).toBe("3 aylık");
  });

  it("reports older pets in years", () => {
    freezeNow();
    expect(petAge("en", new Date("2023-05-22T00:00:00.000Z"))).toBe("3 yr");
    expect(petAge("tr", new Date("2023-05-22T00:00:00.000Z"))).toBe("3 yaşında");
  });
});

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T09:00:00.000Z"));
    return new Date(iso);
  }

  it("names the unit it actually divided down to", () => {
    expect(relativeTime("en", at("2026-09-22T09:00:00.000Z"))).toBe("in 2 days");
    expect(relativeTime("en", at("2026-09-20T13:00:00.000Z"))).toBe("in 4 hours");
    expect(relativeTime("en", at("2026-09-20T09:30:00.000Z"))).toBe("in 30 minutes");
  });

  it("handles the past the same way", () => {
    expect(relativeTime("en", at("2026-09-18T09:00:00.000Z"))).toBe("2 days ago");
  });
});

describe("time zones", () => {
  // 00:30 UTC is already the 21st in Istanbul.
  const lateNight = new Date("2026-09-20T22:30:00.000Z");

  it("formats against the clinic zone, not the runtime's", () => {
    expect(formatTime({ locale: "en", timeZone: "Europe/Istanbul" }, lateNight)).toBe(
      "1:30 AM",
    );
    expect(formatTime({ locale: "en", timeZone: "UTC" }, lateNight)).toBe("10:30 PM");
  });

  it("puts an instant on the right calendar day", () => {
    expect(dayKey(lateNight, "Europe/Istanbul")).toBe("2026-09-21");
    expect(dayKey(lateNight, "UTC")).toBe("2026-09-20");
  });
});

describe("formatDuration", () => {
  it("uses the locale's unit", () => {
    expect(formatDuration("en", 30)).toBe("30 min");
    expect(formatDuration("tr", 30)).toBe("30 dk");
    expect(formatDuration("tr", null)).toBe("-");
  });
});

describe("wallTimeToInstant", () => {
  it("reads a wall-clock time in the given zone", () => {
    // 11:30 in Istanbul (UTC+3) is 08:30 UTC.
    expect(
      wallTimeToInstant("2026-09-23T11:30", "Europe/Istanbul")?.toISOString(),
    ).toBe("2026-09-23T08:30:00.000Z");
    expect(wallTimeToInstant("2026-09-23T11:30", "UTC")?.toISOString()).toBe(
      "2026-09-23T11:30:00.000Z",
    );
  });

  it("follows daylight saving in zones that observe it", () => {
    // Berlin is UTC+2 in July and UTC+1 in January.
    expect(
      wallTimeToInstant("2026-07-01T12:00", "Europe/Berlin")?.toISOString(),
    ).toBe("2026-07-01T10:00:00.000Z");
    expect(
      wallTimeToInstant("2026-01-01T12:00", "Europe/Berlin")?.toISOString(),
    ).toBe("2026-01-01T11:00:00.000Z");
  });

  it("round-trips with toDateTimeInput", () => {
    const zone = "Europe/Istanbul";
    const instant = wallTimeToInstant("2026-09-23T11:30", zone)!;
    expect(toDateTimeInput(instant, zone)).toBe("2026-09-23T11:30");
  });

  it("returns null for anything that is not a wall-clock time", () => {
    expect(wallTimeToInstant("", "UTC")).toBeNull();
    expect(wallTimeToInstant("tomorrow", "UTC")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("shows the decimals the currency actually has", () => {
    expect(formatMoney("tr", 123_456, "TRY")).toBe("₺1.234,56");
    expect(formatMoney("en", 123_456, "USD")).toBe("$1,234.56");
    // Yen has no minor unit; a forced "¥1.234,00" is not money anyone writes.
    expect(formatMoney("en", 123_400, "JPY")).toBe("¥1,234");
  });

  it("treats a missing amount as zero rather than printing nothing", () => {
    expect(formatMoney("en", null, "USD")).toBe("$0.00");
  });
});
