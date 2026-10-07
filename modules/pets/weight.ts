/**
 * The weight to show for an animal, and since when.
 *
 * A weight is entered in two places: the pet form, and the vitals of a
 * visit. The vet typed 4,2 kg into a visit and the animal's card still
 * said "-", so the dose was worked out from a number they had to type a
 * second time. The answer is derived rather than copied -- the newest of
 * the two readings wins -- so there is one weight and nothing to keep in
 * step.
 *
 * A pet-form weight with no date (written before `weightRecordedAt`
 * existed) is older than any visit: nobody can say when it was true, and
 * a dated reading is the better claim.
 */
export interface WeightReading {
  kg: number;
  /** Null for a pet-form weight from before readings were dated. */
  at: Date | null;
  source: "visit" | "pet";
}

export function currentWeight(
  pet: { weightKg: number | null; weightRecordedAt: Date | null },
  latestVisit: { weightKg: number | null; visitedAt: Date } | null | undefined,
): WeightReading | null {
  const fromVisit =
    latestVisit?.weightKg != null
      ? { kg: latestVisit.weightKg, at: latestVisit.visitedAt, source: "visit" as const }
      : null;
  const fromPet =
    pet.weightKg != null
      ? { kg: pet.weightKg, at: pet.weightRecordedAt, source: "pet" as const }
      : null;
  if (!fromVisit) return fromPet;
  if (!fromPet || !fromPet.at) return fromVisit;
  return fromPet.at > fromVisit.at ? fromPet : fromVisit;
}
