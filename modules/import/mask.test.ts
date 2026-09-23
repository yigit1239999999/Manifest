import { describe, expect, it } from "vitest";
import { mask, maskedSamples } from "./mask";
import { classifyColumn } from "./infer";

/**
 * These three assertions are not test cases. They are the decision.
 *
 * On 23 September 2026 the product owner was shown four options, each spelling
 * out exactly what would leave the machine, and chose this one by its three
 * examples. So the first test below quotes those examples verbatim: if it ever
 * goes red, something is being sent that was not approved, and the fix is
 * never to update the expectation.
 */
describe("what the product owner approved, quoted", () => {
  it("masks the three values the decision was made on", () => {
    expect(mask("Ayşe Çelik")).toBe("Xxxx Xxxxx");
    expect(mask("0532 111 22 33")).toBe("0XXX XXX XX XX");
    expect(mask("14.03.2025")).toBe("XX.XX.XXXX");
  });
});

describe("the exemption covers phones, and nothing that merely resembles one", () => {
  it("does not let a date keep its first digit", () => {
    // This is a regression, and it was found by a test written for something
    // else. The exemption started life as "a leading 0 is format", and the
    // second of the month starts with a zero: 02.04.2025 went out as
    // 0X.XX.XXXX -- a real value, in the payload whose whole promise is that
    // real values do not leave.
    expect(mask("02.04.2025")).toBe("XX.XX.XXXX");
    expect(mask("0532 111 22 33")).toBe("0XXX XXX XX XX");
  });

  it("does not let anything else that starts with a zero keep it either", () => {
    // "kg" and "yaş" start a new run after the separator, so their first
    // letter is X -- that is the word-boundary rule doing its job, not a leak.
    expect(mask("0 kg")).toBe("X Xx");
    expect(mask("07")).toBe("XX");
    expect(mask("0-1 yaş")).toBe("X-X Xxx");
  });
});

describe("shape survives, content does not", () => {
  it("keeps the separators, because the separators are the question", () => {
    // Whether this file writes numbers spaced, joined or dashed is precisely
    // what we are asking about. Masking the separators would mask the answer.
    expect(mask("05321112233")).toBe("0XXXXXXXXXX");
    expect(mask("0532-111-22-33")).toBe("0XXX-XXX-XX-XX");
    expect(mask("(0532) 111 22 33")).toBe("(XXXX) XXX XX XX");
    expect(mask("2025-03-14")).toBe("XXXX-XX-XX");
  });

  it("does not leak a Turkish letter through the separator branch", () => {
    // /[a-z]/i would send ş, ğ, ı, ö, ü, ç to the separator branch: "Ayşe"
    // would come out "Xxşx", leaking the letter AND splitting the word so the
    // next character reads as a new one. On a Turkish file that is most names.
    expect(mask("Ayşe")).toBe("Xxxx");
    expect(mask("Çağrı Işık")).toBe("Xxxxx Xxxx");
    expect(mask("Gülşah")).toBe("Xxxxxx");
  });

  it("does not carry the vet's shift key out of the building", () => {
    // The difference between these is typing, not meaning.
    expect(mask("AYŞE ÇELİK")).toBe(mask("Ayşe Çelik"));
    expect(mask("ayşe çelik")).toBe(mask("Ayşe Çelik"));
  });

  it("gives back nothing for nothing", () => {
    expect(mask("")).toBe("");
    expect(mask("   ")).toBe("");
  });
});

describe("the samples a column is described by", () => {
  it("shows three DIFFERENT values, not three copies of one", () => {
    const samples = maskedSamples(["Kedi", "Kedi", "Kedi", "Köpek", "Kuş"]);
    expect(samples).toEqual(["Xxxx", "Xxxxx", "Xxx"]);
  });

  it("does not spend a sample slot on a blank", () => {
    expect(maskedSamples(["", "  ", "Boncuk"])).toEqual(["Xxxxxx"]);
  });
});

describe("masking is for the OUTBOUND payload, never for our own reading", () => {
  it("would destroy the evidence infer.ts runs on -- which is why it runs first", () => {
    // This is the failure the ordering exists to prevent. Masked first, the
    // day-first proof is gone and every date column on earth is ambiguous.
    const real = ["14.03.2025", "02.04.2025", "27.11.2024"];
    expect(classifyColumn(real).dateOrder).toBe("dayFirst");

    const masked = real.map(mask);
    expect(masked).toEqual(["XX.XX.XXXX", "XX.XX.XXXX", "XX.XX.XXXX"]);
    expect(classifyColumn(masked).kind).not.toBe("date");

    // Same for phones: a masked column can no longer be recognised as one.
    expect(classifyColumn(["0532 111 22 33", "0533 222 33 44"]).kind).toBe("phone");
    expect(classifyColumn(["0XXX XXX XX XX", "0XXX XXX XX XX"]).kind).not.toBe("phone");
  });
});
