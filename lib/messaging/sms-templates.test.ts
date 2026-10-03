import { describe, expect, it } from "vitest";
import { composeAppointmentSms, composeReminderSms } from "./sms-templates";
import { smsSegments } from "./sms/segments";
import type { AppointmentMessageContext } from "@/lib/whatsapp/messages";
import { ownerLabel } from "@/lib/pet-label";

const base: AppointmentMessageContext = {
  locale: "tr",
  clientName: "Ayşe Yılmaz",
  petName: "Sarı",
  startsAt: new Date("2026-09-20T11:30:00.000Z"),
  durationMinutes: 30,
  visitType: "Aşı",
  vetName: "Dr. Kaya",
  clinic: { name: "Yiğit Klinik", phone: "0212 555 00 00", address: "Kadıköy", timezone: "Europe/Istanbul" },
  now: new Date("2026-09-20T05:00:00.000Z"),
};

describe("composeAppointmentSms", () => {
  it("fits a Turkish confirmation into one 7-bit segment", () => {
    const text = composeAppointmentSms("APPOINTMENT_CONFIRMATION", base);
    expect(text).toBe(
      "Sayın Ayşe Yılmaz, Sarı için 20 Eyl Paz 14:30 randevunuz oluşturulmuştur. Aşı, Dr. Kaya. Yiğit Klinik 0212 555 00 00",
    );
    expect(smsSegments(text)).toMatchObject({ encoding: "GSM-7-TR", segments: 1 });
  });

  it("says bugün in a same-day reminder and stays short", () => {
    const text = composeAppointmentSms("APPOINTMENT_REMINDER", base);
    expect(text).toContain("Sarı için bugün 14:30 randevunuz bulunmaktadır.");
    expect(smsSegments(text).segments).toBe(1);
  });

  it("writes English for English-speaking clients", () => {
    const text = composeAppointmentSms("APPOINTMENT_CONFIRMATION", { ...base, locale: "en", visitType: "Vaccination" });
    expect(text).toBe(
      "Dear Ayşe Yılmaz, your appointment for Sarı is set for Sun, Sep 20 at 14:30. Vaccination, Dr. Kaya. Yiğit Klinik 0212 555 00 00",
    );
  });
});

describe("composeReminderSms", () => {
  it("writes a compact vaccination notice", () => {
    const text = composeReminderSms({
      locale: "tr",
      clientName: "Ayşe Yılmaz",
      petName: "Sarı",
      type: "VACCINATION_DUE",
      title: "Karma aşı",
      dueAt: new Date("2026-10-01T09:00:00.000Z"),
      clinic: { name: "Yiğit Klinik", phone: "0212 555 00 00", timezone: "Europe/Istanbul" },
    });
    expect(text).toBe(
      "Sayın Ayşe Yılmaz, Sarı için aşı zamanı yaklaşıyor (1 Eki Per). Randevu için bize ulaşabilirsiniz. Yiğit Klinik 0212 555 00 00",
    );
    expect(smsSegments(text).segments).toBe(1);
  });
});

/**
 * The owner with one name, in the message that reaches them.
 *
 * `Client.lastName` is nullable because the counter is not allowed to
 * ask the lady who brings the street cat for hers. Three call sites
 * built `clientName` as `${firstName} ${lastName}`.trim() -- the trim
 * covered the trailing space and not the other half, because a missing
 * surname arrives in a template literal as the word "null". So the
 * message this composes was about to open "Sayın Ayşe null,".
 *
 * Composed here rather than asserted on the helper, because the helper
 * was never wrong: what matters is that the sentence leaving the
 * clinic says the owner's name and nothing about the column.
 */
describe("a client who has only one name", () => {
  it("is addressed by it, with no word standing in for the absent half", () => {
    const text = composeAppointmentSms("APPOINTMENT_CONFIRMATION", {
      ...base,
      clientName: ownerLabel({ firstName: "Ayşe", lastName: null }),
    });

    expect(text).toContain("Sayın Ayşe,");
    expect(text).not.toMatch(/null|undefined/);
    expect(text).not.toMatch(/Ayşe\s{2,}/);
  });
});
