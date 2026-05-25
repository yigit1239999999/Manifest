"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { prescriptionSchema } from "./schema";
import { createPrescription, updatePrescriptionStatus } from "./service";

export const createPrescriptionAction = action(
  "prescription.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(prescriptionSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const prescription = await createPrescription(parsed.data, ctx);
    revalidatePath(`/pets/${prescription.petId}`);
    revalidatePath("/prescriptions");
    if (prescription.visitId) revalidatePath(`/visits/${prescription.visitId}`);
    return { success: true };
  },
);

export const completePrescriptionAction = action(
  "prescription.complete",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await updatePrescriptionStatus(id, "COMPLETED", ctx);
    revalidatePath(`/pets/${petId}`);
    revalidatePath("/prescriptions");
  },
);

export const cancelPrescriptionAction = action(
  "prescription.cancel",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await updatePrescriptionStatus(id, "CANCELLED", ctx);
    revalidatePath(`/pets/${petId}`);
    revalidatePath("/prescriptions");
  },
);
