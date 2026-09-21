import { describe, expect, it } from "vitest";
import {
  composeAppointmentMessage,
  composeReminderMessage,
  whatsappLink,
  type AppointmentMessageContext,
} from "./messages";

const base: AppointmentMessageContext = {
  locale: "tr",
  clientName: "Ayşe Yılmaz",
  petName: "Sarı",
  startsAt: new Date("2026-09-20T11:30:00.000Z"), // 14:30 Istanbul
  durationMinutes: 30,
  visitType: "Aşı",
  vetName: "Dr. Kaya",
  clinic: {
    name: "Yiğit Klinik",
    phone: "0212 555 00 00",
    address: "Kadıköy, İstanbul",
    timezone: "Europe/Istanbul",
  },
  now: new Date("2026-09-20T05:00:00.000Z"),
};

describe("whatsappLink", () => {
  it("builds a wa.me deep link with the encoded body", () => {
    expect(whatsappLink("905321234567", "Merhaba dünya")).toBe(
      "https://wa.me/905321234567?text=Merhaba%20d%C3%BCnya",
    );
  });
});

describe("composeAppointmentMessage", () => {
  it("writes a formal Turkish confirmation in clinic time", () => {
    const text = composeAppointmentMessage("APPOINTMENT_CONFIRMATION", base);
    expect(text).toContain("Sayın Ayşe Yılmaz,");
    expect(text).toContain("Sarı için randevunuz oluşturulmuştur.");
    expect(text).toContain("20 Eylül 2026 Pazar");
    expect(text).toContain("🕒 14:30 (yaklaşık 30 dakika)");
    expect(text).toContain("🩺 Aşı · Dr. Kaya");
    expect(text).toContain("📍 Yiğit Klinik, Kadıköy, İstanbul");
    expect(text).toContain("0212 555 00 00 numarasından");
    expect(text).not.toContain("—");
  });

  it("says 'bugün' in a same-day Turkish reminder", () => {
    const text = composeAppointmentMessage("APPOINTMENT_REMINDER", base);
    expect(text).toContain("Sarı için bugün saat 14:30 randevunuz bulunmaktadır.");
  });

  it("switches to English for English-speaking clients", () => {
    const text = composeAppointmentMessage("APPOINTMENT_REMINDER", {
      ...base,
      locale: "en",
      visitType: "Vaccination",
      now: new Date("2026-09-19T05:00:00.000Z"),
    });
    expect(text).toContain("Dear Ayşe Yılmaz,");
    expect(text).toContain("has an appointment tomorrow at 14:30.");
    expect(text).toContain("Kind regards,");
  });

  it("omits the phone sentence fragment when the clinic has no phone", () => {
    const text = composeAppointmentMessage("APPOINTMENT_CONFIRMATION", {
      ...base,
      clinic: { ...base.clinic, phone: null },
    });
    expect(text).toContain("Değişiklik veya iptal için bize ulaşabilirsiniz.");
  });
});

describe("composeReminderMessage", () => {
  const clinic = { name: "Yiğit Klinik", phone: "0212 555 00 00", timezone: "Europe/Istanbul" };
  it("writes a vaccination-due notice in Turkish", () => {
    const text = composeReminderMessage({
      locale: "tr",
      clientName: "Ayşe Yılmaz",
      petName: "Sarı",
      type: "VACCINATION_DUE",
      title: "Karma aşı",
      dueAt: new Date("2026-10-01T09:00:00.000Z"),
      clinic,
    });
    expect(text).toContain("Sarı için aşı zamanı yaklaşıyor. Planlanan tarih: 1 Ekim 2026 Perşembe.");
    expect(text).toContain("0212 555 00 00 numarasından bize ulaşabilirsiniz.");
  });

  it("uses the custom title for custom reminders and includes the body", () => {
    const text = composeReminderMessage({
      locale: "en",
      clientName: "Jane Smith",
      petName: "Max",
      type: "CUSTOM",
      title: "Bring the previous lab results",
      body: "Please arrive fasting.",
      dueAt: new Date("2026-10-01T09:00:00.000Z"),
      clinic,
    });
    expect(text).toContain("Bring the previous lab results (Thursday, October 1, 2026)");
    expect(text).toContain("Please arrive fasting.");
  });
});
