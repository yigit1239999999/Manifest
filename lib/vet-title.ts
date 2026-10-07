/**
 * A vet's name as a printed document writes it: with the title.
 *
 * "Vet. Hek." in Turkish and "Dr." in English, and only for the people who
 * hold it -- a receptionist who issued an invoice is not a physician. A
 * name that already carries a title ("Dr. Ayşe Demir", "Prof. ...") is
 * left alone rather than written "Vet. Hek. Dr. Ayşe Demir".
 */
const TITLED = /^(dr|vet|prof|doç|doc|uzm)\b\.?/i;

export function vetWithTitle(name: string, role: string | null | undefined, locale: string): string {
  const trimmed = name.trim();
  if (role !== "VETERINARIAN" && role !== "ADMIN") return trimmed;
  if (TITLED.test(trimmed)) return trimmed;
  return locale === "tr" ? `Vet. Hek. ${trimmed}` : `Dr. ${trimmed}`;
}
