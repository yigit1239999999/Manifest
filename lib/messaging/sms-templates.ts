// SMS copy: the same facts as the WhatsApp templates, compressed to fit one
// or two segments with Turkish characters intact. No emoji, no blank lines.

import type {
  AppointmentMessageContext,
  AppointmentMessageKind,
  ReminderMessageContext,
  ReminderType,
} from "@/lib/whatsapp/messages";
import type { MessageLocale } from "./types";

function intl(locale: MessageLocale): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

/** "20 Eyl Paz" / "Sun 20 Sep" */
function shortDate(date: Date, locale: MessageLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(intl(locale), {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
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

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function relativeDay(ctx: AppointmentMessageContext): string {
  const now = ctx.now ?? new Date();
  const tz = ctx.clinic.timezone;
  const target = dayKey(ctx.startsAt, tz);
  if (target === dayKey(now, tz)) return ctx.locale === "tr" ? "bugün" : "today";
  if (target === dayKey(new Date(now.getTime() + 86_400_000), tz))
    return ctx.locale === "tr" ? "yarın" : "tomorrow";
  const d = shortDate(ctx.startsAt, ctx.locale, tz);
  return ctx.locale === "tr" ? d : `on ${d}`;
}

function signature(clinic: { name: string; phone?: string | null }): string {
  const phone = clinic.phone?.trim();
  return phone ? `${clinic.name} ${phone}` : clinic.name;
}

export function composeAppointmentSms(
  kind: AppointmentMessageKind,
  ctx: AppointmentMessageContext,
): string {
  const tz = ctx.clinic.timezone;
  const time = clock(ctx.startsAt, ctx.locale, tz);
  const who = ctx.vetName ? `, ${ctx.vetName}` : "";
  const sig = signature(ctx.clinic);

  if (ctx.locale === "tr") {
    if (kind === "APPOINTMENT_CONFIRMATION") {
      return `Sayın ${ctx.clientName}, ${ctx.petName} için ${shortDate(ctx.startsAt, "tr", tz)} ${time} randevunuz oluşturulmuştur. ${ctx.visitType}${who}. ${sig}`;
    }
    return `Sayın ${ctx.clientName}, ${ctx.petName} için ${relativeDay(ctx)} ${time} randevunuz bulunmaktadır. Gelemeyecekseniz lütfen bildiriniz. ${sig}`;
  }
  if (kind === "APPOINTMENT_CONFIRMATION") {
    return `Dear ${ctx.clientName}, your appointment for ${ctx.petName} is set for ${shortDate(ctx.startsAt, "en", tz)} at ${time}. ${ctx.visitType}${who}. ${sig}`;
  }
  return `Dear ${ctx.clientName}, reminder: ${ctx.petName} has an appointment ${relativeDay(ctx)} at ${time}. Please let us know if you cannot attend. ${sig}`;
}

export function composeReminderSms(ctx: ReminderMessageContext): string {
  const date = shortDate(ctx.dueAt, ctx.locale, ctx.clinic.timezone);
  const pet = ctx.petName?.trim();
  const sig = signature(ctx.clinic);

  if (ctx.locale === "tr") {
    const lead: Record<ReminderType, string> = {
      VACCINATION_DUE: `${pet ? `${pet} için ` : ""}aşı zamanı yaklaşıyor (${date}).`,
      CHECKUP: `${pet ? `${pet} için ` : ""}kontrol zamanı geldi (${date}).`,
      FOLLOWUP: `${pet ? `${pet} için ` : ""}takip kontrolü öneriyoruz (${date}).`,
      BIRTHDAY: pet ? `${pet} için doğum günü kutlu olsun!` : `Doğum gününüz kutlu olsun!`,
      CUSTOM: `${ctx.title} (${date}).`,
    };
    return `Sayın ${ctx.clientName}, ${lead[ctx.type]} Randevu için bize ulaşabilirsiniz. ${sig}`;
  }
  const lead: Record<ReminderType, string> = {
    VACCINATION_DUE: `${pet ? `${pet}'s ` : "a "}vaccination is due (${date}).`,
    CHECKUP: `${pet ? `${pet} is` : "a check-up is"} due for a check-up (${date}).`,
    FOLLOWUP: `we recommend a follow-up${pet ? ` for ${pet}` : ""} (${date}).`,
    BIRTHDAY: pet ? `happy birthday to ${pet}!` : `happy birthday!`,
    CUSTOM: `${ctx.title} (${date}).`,
  };
  return `Dear ${ctx.clientName}, ${lead[ctx.type]} Contact us to book an appointment. ${sig}`;
}
