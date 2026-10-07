import type { InvoiceLineKind } from "@/generated/prisma/enums";

/**
 * What an invoice line says, in the language of whoever is reading it.
 *
 * A line raised from a visit stores the vet's own words for the thing
 * billed ("Kuduz", "Amoksisilin 250 mg") and, separately, what KIND of
 * thing it is. The kind is named here, at reading time, so a Turkish
 * clinic's invoice opened by an English-speaking colleague says
 * "Vaccination · Kuduz" rather than "Aşı · Kuduz" (C8). A VISIT line nobody
 * edited is drawn entirely from the visit -- its type and date, translated
 * -- because its stored words were only ever those two facts in the
 * creator's language.
 *
 * A line typed by hand has no kind and is printed exactly as typed.
 */
export function invoiceLineText(
  line: {
    description: string;
    kind: InvoiceLineKind | null;
    visit?: { type: string; visitedAt: Date } | null;
  },
  words: {
    kind: (kind: InvoiceLineKind) => string;
    visitType: (type: string) => string;
    date: (date: Date) => string;
  },
): string {
  if (!line.kind) return line.description;
  if (line.kind === "VISIT") {
    return line.visit
      ? `${words.visitType(line.visit.type)} · ${words.date(line.visit.visitedAt)}`
      : line.description;
  }
  return `${words.kind(line.kind)} · ${line.description}`;
}
