"use server";

import { action, parse, type FormState } from "@/lib/action";
import { clinicSettingsSchema } from "./schema";
import { setClinicCurrency } from "./service";

export const setClinicCurrencyAction = action(
  "clinic.setCurrency",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(clinicSettingsSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await setClinicCurrency(parsed.data, ctx);
    return { success: true };
  },
);
