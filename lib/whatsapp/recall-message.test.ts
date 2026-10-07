import { describe, expect, it } from "vitest";
import { composeRecallBatch, composeRecallMessage, type RecallItem } from "./recall-message";

const clinic = { name: "Hâl Kliniği", phone: "0212 555 00 00", timezone: "Europe/Istanbul" };
const now = new Date("2026-10-07T09:00:00Z");

function item(over: Partial<RecallItem> = {}): RecallItem {
  return {
    ownerId: "c1",
    ownerName: "Ayşe Tekin",
    ownerPhone: "0532 411 22 33",
    ownerLocale: "tr",
    petName: "Fındık",
    vaccine: "Kuduz",
    dueAt: new Date("2026-09-01T09:00:00Z"),
    ...over,
  };
}

describe("composeRecallMessage", () => {
  it("names the animal, the vaccine, the date and the clinic's number", () => {
    const text = composeRecallMessage([item()], clinic, now);
    expect(text).toContain("Sayın Ayşe Tekin,");
    expect(text).toContain("Aşağıdaki aşının zamanı geldi:");
    expect(text).toContain("• Fındık: Kuduz (1 Eylül 2026)");
    expect(text).toContain("0212 555 00 00 numarasından");
    expect(text.endsWith("Hâl Kliniği")).toBe(true);
  });

  it("says 'coming up' when nothing is past due, and plural for several", () => {
    const text = composeRecallMessage(
      [
        item({ dueAt: new Date("2026-10-20T09:00:00Z") }),
        item({ vaccine: "Karma", dueAt: new Date("2026-10-25T09:00:00Z") }),
      ],
      clinic,
      now,
    );
    expect(text).toContain("Aşağıdaki aşıların zamanı yaklaşıyor:");
    expect(text).toContain("• Fındık: Kuduz (20 Ekim 2026), Karma (25 Ekim 2026)");
  });

  it("writes to an English-speaking owner in English", () => {
    const text = composeRecallMessage([item({ ownerLocale: "en" })], clinic, now);
    expect(text).toContain("Dear Ayşe Tekin,");
    expect(text).toContain("call us on 0212 555 00 00");
  });
});

describe("composeRecallBatch", () => {
  it("writes one message per owner, headed by who and where", () => {
    const { text, owners } = composeRecallBatch(
      [
        item(),
        item({ ownerId: "c2", ownerName: "Mehmet Kaya", ownerPhone: null, petName: "Tekir" }),
        item({ petName: "Pamuk", vaccine: "Karma" }),
      ],
      clinic,
      now,
    );
    expect(owners).toBe(2);
    expect(text.match(/Sayın /g)).toHaveLength(2);
    expect(text).toContain("=== Ayşe Tekin · 0532 411 22 33 ===");
    expect(text).toContain("=== Mehmet Kaya ===");
    expect(text).toContain("• Pamuk: Karma");
  });
});
