import { describe, expect, it } from "vitest";
import { isPossiblePhoneText, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("turns Turkish local formats into international digits", () => {
    expect(normalizePhone("0532 123 45 67")).toBe("905321234567");
    expect(normalizePhone("+90 (532) 123 45 67")).toBe("905321234567");
    expect(normalizePhone("5321234567")).toBe("905321234567");
    expect(normalizePhone("0090 532 123 45 67")).toBe("905321234567");
  });

  // The bug: a leading 0 is a national trunk prefix, not part of the number.
  // A UAE clinic's "050…" used to be dialled exactly as written.
  it("replaces the trunk prefix with the clinic's own calling code", () => {
    expect(normalizePhone("050 123 4567", "971")).toBe("971501234567");
    expect(normalizePhone("0532 123 45 67", "49")).toBe("495321234567");
  });

  it("leaves a number that already carries its country code alone", () => {
    expect(normalizePhone("905321234567")).toBe("905321234567");
    expect(normalizePhone("+971 50 123 4567", "971")).toBe("971501234567");
  });

  it("keeps a nine-digit national number instead of dropping it", () => {
    // Nine digits used to fall under a ten-digit floor and vanish silently.
    expect(normalizePhone("0 50 123 4567", "971")).toBe("971501234567");
    expect(normalizePhone("501234567", "971")).toBe("971501234567");
  });

  it("rejects unusable input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("sabit hat yok")).toBeNull();
    expect(normalizePhone("+9999999999999999999")).toBeNull();
  });
});

describe("isPossiblePhoneText", () => {
  it("accepts the shapes people actually type", () => {
    expect(isPossiblePhoneText("0532 123 45 67")).toBe(true);
    expect(isPossiblePhoneText("+90 (532) 123-45-67")).toBe(true);
    expect(isPossiblePhoneText("+971 50 123 4567")).toBe(true);
  });

  it("refuses text that is not a number", () => {
    expect(isPossiblePhoneText("sabit hat yok")).toBe(false);
    expect(isPossiblePhoneText("no landline")).toBe(false);
    expect(isPossiblePhoneText("532")).toBe(false);
    expect(isPossiblePhoneText("0532 123 45 67 +90")).toBe(false);
  });
});
