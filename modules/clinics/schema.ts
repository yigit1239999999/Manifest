import { z } from "zod";
import { requiredEnum } from "@/lib/forms";

/**
 * The currencies a clinic can choose, and deliberately not the full ISO
 * list. A Turkish clinic prices in lira; euro and pound are the only two
 * realistic alternatives it might quote, and dollars cannot be dropped
 * because that is what the existing data is in — a list that does not
 * contain a clinic's current value would silently change it the first time
 * the form is saved.
 */
export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

export const clinicSettingsSchema = z.object({
  currency: requiredEnum(CURRENCIES),
});

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>;
