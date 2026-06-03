// Clinic lookups, deduplicated per request via React's cache().
//
// `auth()`-protected pages need clinic.currency / clinic settings to
// format money and times. Without dedup, six call sites in a single
// dashboard render fire six identical `prisma.clinic.findUnique` queries
// against the same id. cache() collapses them to one for the duration
// of the request, which is the unit React already memoises.

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export interface ClinicSettings {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export const getClinicSettings = cache(
  async (clinicId: string): Promise<ClinicSettings | null> =>
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        currency: true,
        timezone: true,
      },
    }),
);

/** Convenience: just the display currency, defaulting to USD. */
export const getClinicCurrency = cache(async (clinicId: string): Promise<string> => {
  const clinic = await getClinicSettings(clinicId);
  return clinic?.currency ?? "USD";
});
