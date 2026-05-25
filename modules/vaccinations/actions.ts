"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { vaccinationSchema } from "./schema";
import { createVaccination, deleteVaccination } from "./service";

export const createVaccinationAction = action(
  "vaccination.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(vaccinationSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const vaccination = await createVaccination(parsed.data, ctx);
    revalidatePath(`/pets/${vaccination.petId}`);
    if (vaccination.visitId) revalidatePath(`/visits/${vaccination.visitId}`);
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
