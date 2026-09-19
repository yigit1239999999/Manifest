// Per-clinic species visibility.
//
// The built-in Species enum is broad (companion + equine + farm). Each clinic
// picks which of those show up in the pet form so the picker stays short and
// relevant. The choice lives in `Clinic.settings.enabledSpecies` (Json) —
// no schema change needed. Clinic-defined custom species are always shown.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SPECIES } from "@/modules/pets/schema";

/** What a fresh clinic sees: classic companion animals only. */
export const DEFAULT_ENABLED_SPECIES: readonly string[] = [
  "DOG",
  "CAT",
  "BIRD",
  "RABBIT",
  "RODENT",
  "REPTILE",
  "FISH",
  "EXOTIC",
  "OTHER",
];

const SPECIES_SET: ReadonlySet<string> = new Set(SPECIES);

export function normalizeEnabledSpecies(input: unknown): string[] {
  if (!Array.isArray(input)) return [...DEFAULT_ENABLED_SPECIES];
  const seen = new Set<string>();
  // Keep canonical enum order regardless of how the list was saved.
  for (const v of input) if (typeof v === "string" && SPECIES_SET.has(v)) seen.add(v);
  const ordered = SPECIES.filter((s) => seen.has(s));
  return ordered.length > 0 ? ordered : [...DEFAULT_ENABLED_SPECIES];
}

export const getEnabledSpecies = cache(async (clinicId: string): Promise<string[]> => {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { settings: true },
  });
  const settings = (clinic?.settings ?? {}) as { enabledSpecies?: unknown };
  return normalizeEnabledSpecies(settings.enabledSpecies);
});

/** Custom species with how many pets reference each (for safe deletion). */
export async function listCustomSpeciesWithUsage(clinicId: string) {
  const rows = await prisma.customSpecies.findMany({
    where: { clinicId },
    select: { id: true, name: true, _count: { select: { pets: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, petCount: r._count.pets }));
}
