"use server";

import { action, type FormState } from "@/lib/action";
import { setSetupStepsHidden } from "./setup-steps";

export const setSetupStepsHiddenAction = action(
  "clinic.setupStepsHidden",
  async (ctx, hidden: boolean): Promise<FormState> => {
    await setSetupStepsHidden(hidden, ctx);
    return { success: true };
  },
);
