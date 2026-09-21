"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { vaccinationSchema } from "./schema";
import {
  createVaccination,
  deleteVaccination,
  setVaccinationDueDismissed,
} from "./service";

export const createVaccinationAction = action(
  "vaccination.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(vaccinationSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createVaccination(parsed.data, ctx);
    return { success: true };
  },
);

export const deleteVaccinationAction = action(
  "vaccination.delete",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await deleteVaccination(id, ctx);
    revalidatePath(`/pets/${petId}`);
  },
);

/**
 * Closes an overdue row on the dashboard, or puts it back. Both
 * directions through one action so the screen can offer an undo
 * without a second round trip to find out what it undid.
 */
export const setVaccinationDueDismissedAction = action(
  "vaccination.dueDismissed",
  async (ctx, id: string, dismissed: boolean): Promise<FormState> => {
    await setVaccinationDueDismissed(id, dismissed, ctx);
    return { success: true };
  },
);
