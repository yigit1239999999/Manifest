"use server";

import { action, type FormState } from "@/lib/action";
import { undoImport } from "./service";

/**
 * Taking an import back.
 *
 * Returns only success, and deliberately does not `revalidatePath`: an
 * action that returns a value and revalidates races the client transition
 * and leaves the caller waiting. The screen refreshes itself once the
 * result is in, which is the pattern every form on a page here uses.
 */
export const undoImportAction = action(
  "import.undo",
  async (ctx, batchId: string): Promise<FormState> => {
    await undoImport(batchId, ctx);
    return { success: true };
  },
);
