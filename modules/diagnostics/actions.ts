"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { diagnosticSchema } from "./schema";
import {
  createDiagnostic,
  deleteDiagnostic,
  markDiagnosticRead,
} from "./service";

export const createDiagnosticAction = action(
  "diagnostic.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(diagnosticSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createDiagnostic(parsed.data, ctx);
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

/**
 * "I have seen this result."
 *
 * Returns a state rather than redirecting, so the page refreshes in
 * place -- and so no `revalidatePath` runs here: on an action that
 * returns a value it races the client transition and leaves the
 * control spinning.
 */
export const markDiagnosticReadAction = action(
  "diagnostic.markRead",
  async (ctx, id: string): Promise<FormState> => {
    await markDiagnosticRead(id, ctx);
    return { success: true };
  },
);
