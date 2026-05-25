"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { diagnosticSchema } from "./schema";
import { createDiagnostic, deleteDiagnostic } from "./service";

export const createDiagnosticAction = action(
  "diagnostic.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(diagnosticSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const diagnostic = await createDiagnostic(parsed.data, ctx);
    revalidatePath(`/pets/${diagnostic.petId}`);
    if (diagnostic.visitId) revalidatePath(`/visits/${diagnostic.visitId}`);
    return { success: true };
  },
);

export const deleteDiagnosticAction = action(
  "diagnostic.delete",
  async (ctx, id: string): Promise<void> => {
    const { petId } = await deleteDiagnostic(id, ctx);
    revalidatePath(`/pets/${petId}`);
  },
);
