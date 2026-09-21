import { describe, expect, it } from "vitest";
import { isPossiblePhoneText, maskPhone, normalizePhone, telHref } from "./phone";

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

describe("telHref", () => {
  // The number a gateway dials has gone through `normalizePhone` since
  // backlog 6. The number behind a `tel:` link had not: the screens wrote
  // it exactly as someone typed it, so the same field was international in
  // one place and a local string with spaces in the other.
  it("dials the same number the gateway would", () => {
    expect(telHref("0532 111 11 11")).toBe("tel:+905321111111");
    expect(normalizePhone("0532 111 11 11")).toBe("905321111111");
  });

  it("keeps an already-international number as written", () => {
    expect(telHref("+90 (532) 123 45 67")).toBe("tel:+905321234567");
  });

  it("gives nothing back for text that cannot be dialled", () => {
    // So the call site can render plain text. A link that looks tappable
    // and does nothing is worse than no link.
    expect(telHref("sabit hat yok")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref("")).toBeNull();
  });
});

// Appearance is not what decides whether something is a number: digit
// count was, and `0000000000` clears the floor. Somebody who cannot
// leave a field blank types zeros, so this is a habit rather than an
// accident -- and the day a gateway is connected it becomes a real
// send attempt against a number that cannot exist.
describe("a field filled with zeros is not a phone number", () => {
  it("refuses one long enough to have passed the length floor", () => {
    expect(isPossiblePhoneText("0000000000")).toBe(false);
    expect(normalizePhone("0000000000")).toBeNull();
    // The link is the visible half of the same mistake.
    expect(telHref("0000000000")).toBeNull();
  });

  it("keeps refusing the short marker, which the floor already caught", () => {
    // True today for a different reason -- three digits is under the
    // floor -- and this pins it so a change to the floor cannot make
    // `000` dialable without failing here first.
    expect(isPossiblePhoneText("000")).toBe(false);
    expect(normalizePhone("000")).toBeNull();
  });

  it("is decided on what was typed, not on what a calling code adds", () => {
    // Prepending "90" supplies a non-zero digit, so a check made after
    // that would accept everything.
    expect(normalizePhone("0000000000", "90")).toBeNull();
    expect(normalizePhone("+00 000 000 0000")).toBeNull();
  });

  it("still accepts a real number that happens to contain zeros", () => {
    // The rule is "no digit but zero", not "no zeros" -- most Turkish
    // mobiles start with one.
    expect(normalizePhone("0532 000 00 00")).toBe("905320000000");
    expect(isPossiblePhoneText("0500 000 00 01")).toBe(true);
  });
});

// The dry run prints what would go out, and a rehearsal that spreads
// real numbers through a terminal is a poor rehearsal. One reached
// mine today from a read-only query selecting a column it did not
// need.
describe("maskPhone", () => {
  it("keeps enough to tell two recipients apart, and no more", () => {
    expect(maskPhone("905321234567")).toBe("•••• 4567");
    expect(maskPhone("0532 123 45 67")).toBe("•••• 4567");
  });

  it("gives nothing away when there is nothing to keep", () => {
    expect(maskPhone(null)).toBe("••••");
    expect(maskPhone("")).toBe("••••");
    expect(maskPhone("12")).toBe("••••");
  });
});
