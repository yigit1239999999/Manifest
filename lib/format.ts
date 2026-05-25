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

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function toDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  // datetime-local input expects "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function petAge(birthDate: Date | null | undefined): string | null {
  if (!birthDate) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 1) return "Under 1 month";
  if (months < 24) return `${months} mo old`;
  return `${Math.floor(months / 12)} yr old`;
}

export function relativeTime(date: Date | null | undefined): string {
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const inFuture = diffMs > 0;

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.3452, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = absSec;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [divisor, nextUnit] of units) {
    if (value < divisor) break;
    value = value / divisor;
    unit = nextUnit;
  }
  return new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(
    (inFuture ? 1 : -1) * Math.round(value),
    unit,
  );
}

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}
