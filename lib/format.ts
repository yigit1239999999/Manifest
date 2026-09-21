const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog",
  CAT: "Cat",
  BIRD: "Bird",
  RABBIT: "Rabbit",
  RODENT: "Rodent",
  REPTILE: "Reptile",
  FISH: "Fish",
  EXOTIC: "Exotic",
  OTHER: "Other",
};

const SEX_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  UNKNOWN: "Unknown",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  VETERINARIAN: "Veterinarian",
  VET_TECH: "Vet tech",
  RECEPTIONIST: "Receptionist",
};

const VISIT_TYPE_LABELS: Record<string, string> = {
  WELLNESS_CHECK: "Wellness check",
  VACCINATION: "Vaccination",
  SICK_VISIT: "Sick visit",
  EMERGENCY: "Emergency",
  SURGERY: "Surgery",
  DENTAL: "Dental",
  GROOMING: "Grooming",
  FOLLOWUP: "Follow-up",
  TELEHEALTH: "Telehealth",
  OTHER: "Other",
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const NOTE_KIND_LABELS: Record<string, string> = {
  GENERAL: "Note",
  PHONE_CALL: "Phone call",
  EMAIL: "Email",
  SMS: "SMS",
  INTERNAL: "Internal",
  EVENT: "Event",
};

const DIAGNOSTIC_TYPE_LABELS: Record<string, string> = {
  BLOOD: "Blood test",
  URINE: "Urinalysis",
  FECAL: "Fecal test",
  CYTOLOGY: "Cytology",
  CULTURE: "Culture",
  XRAY: "X-Ray",
  ULTRASOUND: "Ultrasound",
  MRI: "MRI",
  CT: "CT scan",
  ECG: "ECG",
  ENDOSCOPY: "Endoscopy",
  OTHER: "Other",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIAL: "Partially paid",
  PAID: "Paid",
  VOID: "Void",
};

export function speciesLabel(species: string): string {
  return SPECIES_LABELS[species] ?? species;
}
export function sexLabel(sex: string): string {
  return SEX_LABELS[sex] ?? sex;
}
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
export function visitTypeLabel(type: string): string {
  return VISIT_TYPE_LABELS[type] ?? type;
}
export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}
export function noteKindLabel(kind: string): string {
  return NOTE_KIND_LABELS[kind] ?? kind;
}
export function diagnosticTypeLabel(type: string): string {
  return DIAGNOSTIC_TYPE_LABELS[type] ?? type;
}
export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status] ?? status;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Maps the app locale ("tr" | "en") to a BCP 47 tag for Intl. */
export function intlLocale(locale: string): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

/**
 * Where and in what language a value is being shown.
 *
 * Times are stored as instants, so a clinic's day only lines up with the
 * clinic's own clock: never format one against the server's zone (Vercel
 * runs on UTC) or a visitor's. Pass the context from `getFormatContext()`
 * — a bare locale string still works and falls back to the runtime zone.
 */
export interface FormatContext {
  locale: string;
  timeZone?: string;
}

export type FormatTarget = string | FormatContext;

function localeOf(target: FormatTarget): string {
  return typeof target === "string" ? target : target.locale;
}

function zoneOf(target: FormatTarget): string | undefined {
  return typeof target === "string" ? undefined : target.timeZone;
}

function dateFormat(
  target: FormatTarget,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlLocale(localeOf(target)), {
    ...options,
    timeZone: zoneOf(target),
  });
}

const EMPTY = "-";

export function formatDate(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  return dateFormat(target, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  return dateFormat(target, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...hourOptions(target),
  }).format(date);
}

export function formatTime(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  return dateFormat(target, hourOptions(target)).format(date);
}

/** Weekday and day, e.g. "Wednesday, 23 September" — for day headings. */
export function formatDayHeading(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  return dateFormat(target, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Turkish writes the clock 24-hour and zero-padded ("09:15"); English
// doesn't ("9:15 AM").
function hourOptions(target: FormatTarget): Intl.DateTimeFormatOptions {
  return {
    hour: localeOf(target) === "tr" ? "2-digit" : "numeric",
    minute: "2-digit",
  };
}

/**
 * "YYYY-MM-DD" for the calendar day an instant falls on in `timeZone`.
 * Grouping by the UTC day would put a 01:30 appointment in Istanbul on the
 * previous day.
 */
export function dayKey(date: Date, timeZone?: string): string {
  // en-CA gives ISO-shaped output for free.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY.test(value);
}

/** The day `days` away from a "YYYY-MM-DD" key. */
export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The instants a clinic's day starts and ends at. A day is a local thing:
 * in Istanbul it runs 21:00–20:59:59.999 UTC, so a 23:30 appointment
 * belongs to the day the clinic is having, not the one UTC is.
 */
export function dayRange(
  key: string,
  timeZone?: string,
): { from: Date; to: Date } | null {
  const from = wallTimeToInstant(`${key}T00:00`, timeZone);
  const nextDay = wallTimeToInstant(`${shiftDayKey(key, 1)}T00:00`, timeZone);
  if (!from || !nextDay) return null;
  return { from, to: new Date(nextDay.getTime() - 1) };
}

/** "30 min" / "30 dk" — the unit follows the locale, not the source. */
export function formatDuration(
  target: FormatTarget,
  minutes: number | null | undefined,
): string {
  if (minutes == null) return EMPTY;
  return localeOf(target) === "tr" ? `${minutes} dk` : `${minutes} min`;
}

/**
 * A calendar date with no time of day (a birth date) is stored at UTC
 * midnight, so it must be read back in UTC or a westward zone shows the
 * day before.
 */
export function formatDateOnly(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  return formatDate({ locale: localeOf(target), timeZone: "UTC" }, date);
}

export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, as read in `timeZone`. */
export function toDateTimeInput(
  date: Date | null | undefined,
  timeZone?: string,
): string {
  if (!date) return "";
  const { year, month, day, hour, minute } = zonedParts(date, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * The instant a wall-clock time ("2026-09-23T11:30", what a datetime-local
 * input holds) refers to in `timeZone`.
 *
 * Without this the string is parsed against whatever clock the runtime
 * happens to be on — the browser's, or UTC on a server — and a clinic's
 * 11:30 appointment silently becomes some other hour.
 */
export function wallTimeToInstant(wall: string, timeZone?: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(wall.trim());
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const asUtc = Date.UTC(+y, +m - 1, +d, +h, +min);
  if (!timeZone) return new Date(asUtc);
  // The offset depends on the instant (DST), and the instant is what we are
  // solving for, so apply the offset once and re-check it at the result.
  let instant = asUtc - zoneOffsetMs(new Date(asUtc), timeZone);
  instant = asUtc - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** How far `timeZone` is ahead of UTC at that instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  return asUtc - instant.getTime();
}

function zonedParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Some engines render midnight as "24" in hour12:false.
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const AGE_COPY = {
  tr: { underMonth: "1 aydan küçük", months: (n: number) => `${n} aylık`, years: (n: number) => `${n} yaşında` },
  en: { underMonth: "Under 1 month", months: (n: number) => `${n} mo`, years: (n: number) => `${n} yr` },
} as const;

export function petAge(
  target: FormatTarget,
  birthDate: Date | null | undefined,
): string | null {
  if (!birthDate) return null;
  const copy = localeOf(target) === "tr" ? AGE_COPY.tr : AGE_COPY.en;
  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 1) return copy.underMonth;
  if (months < 24) return copy.months(months);
  return copy.years(Math.floor(months / 12));
}

export function relativeTime(
  target: FormatTarget,
  date: Date | null | undefined,
): string {
  if (!date) return EMPTY;
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const inFuture = diffMs > 0;

  // Each divisor is paired with the unit it produces: dividing seconds by 60
  // gives minutes. Pairing it with the unit it consumed is what made "2 days
  // from now" read as "in 2 hours".
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [7, "week"],
    [4.3452, "month"],
    [12, "year"],
  ];

  let value = absSec;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [divisor, nextUnit] of units) {
    if (value < divisor) break;
    value = value / divisor;
    unit = nextUnit;
  }
  return new Intl.RelativeTimeFormat(intlLocale(localeOf(target)), {
    numeric: "auto",
  }).format((inFuture ? 1 : -1) * Math.round(value), unit);
}

/**
 * Money for the screen. Amounts are stored as hundredths of the currency's
 * unit (see lib/money.ts, which is the only place text becomes that number).
 *
 * How many decimals to show is the currency's business, not ours: forcing
 * two printed "¥1.000,00" for a currency that has no minor unit at all.
 * `Intl` knows the right count for each one.
 */
export function formatMoney(
  target: FormatTarget,
  cents: number | null | undefined,
  // Required, with no default on purpose: a default meant every call site
  // that forgot to pass the clinic's currency printed dollars, correctly
  // formatted and completely wrong. Forgetting it is now a build error.
  currency: string,
): string {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat(intlLocale(localeOf(target)), {
    style: "currency",
    currency,
  }).format(amount);
}
