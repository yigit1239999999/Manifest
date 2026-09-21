"use server";

import { action, parse, type FormState } from "@/lib/action";
import { clinicSettingsSchema } from "./schema";
import { setClinicCurrency, setFirstStepHidden } from "./service";

export const setClinicCurrencyAction = action(
  "clinic.setCurrency",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(clinicSettingsSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await setClinicCurrency(parsed.data, ctx);
    return { success: true };
  },
);

/**
 * Close the first-step card, or put it back.
 *
 * One action with a flag rather than two, so the two directions cannot
 * drift apart in what they check or what they audit. No
 * `revalidatePath`: this returns a value to a form that stays on the
 * page, and revalidating races the client transition (`lib/action.ts`,
 * `components/forms/use-action-result.ts`) -- the caller refreshes.
 */
export const setFirstStepHiddenAction = action(
  "clinic.setFirstStepHidden",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    await setFirstStepHidden(formData.get("hidden") === "true", ctx);
    return { success: true };
  },
);
