const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog",
  CAT: "Cat",
  BIRD: "Bird",
  RABBIT: "Rabbit",
  REPTILE: "Reptile",
  OTHER: "Other",
};

const SEX_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  UNKNOWN: "Unknown",
};

export function speciesLabel(species: string): string {
  return SPECIES_LABELS[species] ?? species;
}

export function sexLabel(sex: string): string {
  return SEX_LABELS[sex] ?? sex;
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

export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
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
