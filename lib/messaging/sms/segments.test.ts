import { describe, expect, it } from "vitest";
import { smsSegments } from "./segments";

describe("smsSegments", () => {
  it("counts plain ASCII as GSM-7", () => {
    expect(smsSegments("Hello")).toEqual({ encoding: "GSM-7", length: 5, segments: 1 });
    expect(smsSegments("a".repeat(160)).segments).toBe(1);
    expect(smsSegments("a".repeat(161)).segments).toBe(2);
  });

  it("keeps Turkish letters on the 7-bit budget via the national shift table", () => {
    const info = smsSegments("Sayın Ayşe, İstanbul'a hoş geldiniz");
    expect(info.encoding).toBe("GSM-7-TR");
    expect(info.segments).toBe(1);
  });

  it("falls back to UCS-2 for emoji and counts 70-char segments", () => {
    const info = smsSegments("Randevunuz 📅 " + "x".repeat(60));
    expect(info.encoding).toBe("UCS-2");
    expect(info.segments).toBe(2);
  });

  it("charges extended GSM characters double", () => {
    expect(smsSegments("€").length).toBe(2);
  });
});
