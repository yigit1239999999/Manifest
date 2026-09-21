// Outbound WhatsApp copy for appointments.
//
// Pure functions: given an appointment context they return the message a
// client receives, in the client's language and the clinic's timezone. Kept
// free of framework imports so the exact wording is unit-testable.

export type MessageLocale = "tr" | "en";
export type AppointmentMessageKind =
  | "APPOINTMENT_CONFIRMATION"
  | "APPOINTMENT_REMINDER";

export type ReminderType = "VACCINATION_DUE" | "CHECKUP" | "FOLLOWUP" | "BIRTHDAY" | "CUSTOM";

export interface ReminderMessageContext {
  locale: MessageLocale;
  clientName: string;
  petName?: string | null;
  type: ReminderType;
  title: string;
  body?: string | null;
  dueAt: Date;
  clinic: { name: string; phone?: string | null; timezone: string };
}

export interface AppointmentMessageContext {
  locale: MessageLocale;
  clientName: string;
  petName: string;
  startsAt: Date;
  durationMinutes: number;
  visitType: string;
  vetName?: string | null;
  clinic: {
    name: string;
    phone?: string | null;
    address?: string | null;
    timezone: string;
  };
  /** Injectable for deterministic "today / tomorrow" wording in tests. */
  now?: Date;
}

const VISIT_TYPE_LABELS: Record<MessageLocale, Record<string, string>> = {
  tr: {
    WELLNESS_CHECK: "Genel kontrol",
    VACCINATION: "Aşı",
    SICK_VISIT: "Muayene",
    EMERGENCY: "Acil",
    SURGERY: "Cerrahi",
    DENTAL: "Diş",
    GROOMING: "Bakım ve tıraş",
    FOLLOWUP: "Kontrol",
    TELEHEALTH: "Uzaktan görüşme",
    OTHER: "Randevu",
  },
  en: {
    WELLNESS_CHECK: "Wellness check",
    VACCINATION: "Vaccination",
    SICK_VISIT: "Examination",
    EMERGENCY: "Emergency",
    SURGERY: "Surgery",
    DENTAL: "Dental",
    GROOMING: "Grooming",
    FOLLOWUP: "Follow-up",
    TELEHEALTH: "Telehealth",
    OTHER: "Appointment",
  },
};

export function visitTypeLabel(type: string, locale: MessageLocale): string {
  return VISIT_TYPE_LABELS[locale][type] ?? VISIT_TYPE_LABELS[locale].OTHER;
}

export function toMessageLocale(value: string | null | undefined, fallback: MessageLocale = "tr"): MessageLocale {
  return value === "tr" || value === "en" ? value : fallback;
}

export function whatsappLink(phone: string, body: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

function intl(locale: MessageLocale): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function longDate(date: Date, locale: MessageLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function clock(date: Date, locale: MessageLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** "bugün" / "yarın" / full date, relative to `now` in the clinic timezone. */
function relativeDay(ctx: AppointmentMessageContext): string {
  const now = ctx.now ?? new Date();
  const tz = ctx.clinic.timezone;
  const target = dayKey(ctx.startsAt, tz);
  const today = dayKey(now, tz);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), tz);
  if (target === today) return ctx.locale === "tr" ? "bugün" : "today";
  if (target === tomorrow) return ctx.locale === "tr" ? "yarın" : "tomorrow";
  const date = longDate(ctx.startsAt, ctx.locale, tz);
  return ctx.locale === "tr" ? date : `on ${date}`;
}

export function composeAppointmentMessage(
  kind: AppointmentMessageKind,
  ctx: AppointmentMessageContext,
): string {
  const tz = ctx.clinic.timezone;
  const date = longDate(ctx.startsAt, ctx.locale, tz);
  const time = clock(ctx.startsAt, ctx.locale, tz);
  const vet = ctx.vetName ? ` · ${ctx.vetName}` : "";
  const place = ctx.clinic.address ? `${ctx.clinic.name}, ${ctx.clinic.address}` : ctx.clinic.name;
  const phone = ctx.clinic.phone?.trim();

  if (ctx.locale === "tr") {
    if (kind === "APPOINTMENT_CONFIRMATION") {
      return [
        `Sayın ${ctx.clientName},`,
        "",
        `${ctx.petName} için randevunuz oluşturulmuştur.`,
        "",
        `📅 ${date}`,
        `🕒 ${time} (yaklaşık ${ctx.durationMinutes} dakika)`,
        `🩺 ${ctx.visitType}${vet}`,
        `📍 ${place}`,
        "",
        `Randevunuzdan birkaç dakika önce klinikte olmanızı rica ederiz. Değişiklik veya iptal için ${phone ? `${phone} numarasından ` : ""}bize ulaşabilirsiniz.`,
        "",
        "Sağlıklı günler dileriz.",
        ctx.clinic.name,
      ].join("\n");
    }
    return [
      `Sayın ${ctx.clientName},`,
      "",
      `${ctx.petName} için ${relativeDay(ctx)} saat ${time} randevunuz bulunmaktadır.`,
      "",
      `🩺 ${ctx.visitType}${vet}`,
      `📍 ${place}`,
      "",
      `Gelemeyecekseniz lütfen önceden haber vermenizi rica ederiz${phone ? ` (${phone})` : ""}.`,
      "",
      "Sağlıklı günler dileriz.",
      ctx.clinic.name,
    ].join("\n");
  }

  if (kind === "APPOINTMENT_CONFIRMATION") {
    return [
      `Dear ${ctx.clientName},`,
      "",
      `Your appointment for ${ctx.petName} has been scheduled.`,
      "",
      `📅 ${date}`,
      `🕒 ${time} (approx. ${ctx.durationMinutes} minutes)`,
      `🩺 ${ctx.visitType}${vet}`,
      `📍 ${place}`,
      "",
      `Please arrive a few minutes early. To reschedule or cancel, contact us${phone ? ` at ${phone}` : ""}.`,
      "",
      "Kind regards,",
      ctx.clinic.name,
    ].join("\n");
  }
  return [
    `Dear ${ctx.clientName},`,
    "",
    `This is a reminder that ${ctx.petName} has an appointment ${relativeDay(ctx)} at ${time}.`,
    "",
    `🩺 ${ctx.visitType}${vet}`,
    `📍 ${place}`,
    "",
    `If you are unable to attend, please let us know in advance${phone ? ` (${phone})` : ""}.`,
    "",
    "Kind regards,",
    ctx.clinic.name,
  ].join("\n");
}

export function composeReminderMessage(ctx: ReminderMessageContext): string {
  const tz = ctx.clinic.timezone;
  const date = longDate(ctx.dueAt, ctx.locale, tz);
  const phone = ctx.clinic.phone?.trim();
  const pet = ctx.petName?.trim();
  const extra = ctx.body?.trim();

  if (ctx.locale === "tr") {
    const lead: Record<ReminderType, string> = {
      VACCINATION_DUE: pet
        ? `${pet} için aşı zamanı yaklaşıyor. Planlanan tarih: ${date}.`
        : `Aşı zamanı yaklaşıyor. Planlanan tarih: ${date}.`,
      CHECKUP: pet
        ? `${pet} için kontrol muayenesi zamanı geldi. Önerilen tarih: ${date}.`
        : `Kontrol muayenesi zamanı geldi. Önerilen tarih: ${date}.`,
      FOLLOWUP: pet
        ? `${pet} için takip kontrolü öneriyoruz. Tarih: ${date}.`
        : `Takip kontrolü öneriyoruz. Tarih: ${date}.`,
      BIRTHDAY: pet
        ? `${date}, ${pet} için özel bir gün: doğum gününü kutlarız! 🎉`
        : `Doğum gününüzü kutlarız! 🎉`,
      CUSTOM: `${ctx.title} (${date})`,
    };
    return [
      `Sayın ${ctx.clientName},`,
      "",
      lead[ctx.type],
      ...(extra ? ["", extra] : []),
      "",
      `Randevu oluşturmak için ${phone ? `${phone} numarasından ` : ""}bize ulaşabilirsiniz.`,
      "",
      "Sağlıklı günler dileriz.",
      ctx.clinic.name,
    ].join("\n");
  }

  const lead: Record<ReminderType, string> = {
    VACCINATION_DUE: pet
      ? `${pet}'s vaccination is coming up. Scheduled date: ${date}.`
      : `A vaccination is coming up. Scheduled date: ${date}.`,
    CHECKUP: pet
      ? `${pet} is due for a check-up. Suggested date: ${date}.`
      : `A check-up is due. Suggested date: ${date}.`,
    FOLLOWUP: pet
      ? `We recommend a follow-up visit for ${pet}. Date: ${date}.`
      : `We recommend a follow-up visit. Date: ${date}.`,
    BIRTHDAY: pet
      ? `${date} is a special day for ${pet}: happy birthday! 🎉`
      : `Happy birthday! 🎉`,
    CUSTOM: `${ctx.title} (${date})`,
  };
  return [
    `Dear ${ctx.clientName},`,
    "",
    lead[ctx.type],
    ...(extra ? ["", extra] : []),
    "",
    `To book an appointment, contact us${phone ? ` at ${phone}` : ""}.`,
    "",
    "Kind regards,",
    ctx.clinic.name,
  ].join("\n");
}
