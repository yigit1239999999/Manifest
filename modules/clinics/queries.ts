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
  /**
   * When the first-step card was closed, or null if it was not.
   *
   * Free to ask for: the dashboard already loads this row for the
   * clinic's name and currency, and this rides along in the same
   * cached select rather than adding a query to every render.
   */
  firstStepHiddenAt: Date | null;
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
        firstStepHiddenAt: true,
      },
    }),
);

/** Convenience: just the display currency, defaulting to USD. */
export const getClinicCurrency = cache(async (clinicId: string): Promise<string> => {
  const clinic = await getClinicSettings(clinicId);
  return clinic?.currency ?? "USD";
});

/**
 * How many invoices the clinic has already issued. The currency setting asks
 * for confirmation only when there are some: in an empty clinic the question
 * has no content and is just a click to get through.
 */
export const countClinicInvoices = cache(
  async (clinicId: string): Promise<number> =>
    prisma.invoice.count({ where: { clinicId } }),
);
