"use server";

import { action, type FormState } from "@/lib/action";
import { dismissImportPrompt } from "./service";

export const dismissImportPromptAction = action(
  "import.dismissPrompt",
  async (ctx): Promise<FormState> => {
    await dismissImportPrompt(ctx);
    return { success: true };
  },
);
