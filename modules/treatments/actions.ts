"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { treatmentSchema } from "./schema";
import { createTreatment, deleteTreatment } from "./service";

export const createTreatmentAction = action(
  "treatment.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(treatmentSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createTreatment(parsed.data, ctx);
    return { success: true };
  },
);

export const deleteTreatmentAction = action(
  "treatment.delete",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await deleteTreatment(id, ctx);
    revalidatePath(`/pets/${petId}`);
  },
);
