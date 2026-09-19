"use server";

import { revalidatePath } from "next/cache";
import { action, type FormState } from "@/lib/action";
import { deleteCustomSpecies, setEnabledSpecies } from "./service";

export const setEnabledSpeciesAction = action(
  "species.setEnabled",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const keys = formData.getAll("species").map(String);
    await setEnabledSpecies(keys, ctx);
    return { success: true };
  },
);

export const deleteCustomSpeciesAction = action(
  "species.deleteCustom",
  async (ctx, id: string): Promise<void> => {
    await deleteCustomSpecies(id, ctx);
    revalidatePath("/settings");
    revalidatePath("/pets/new");
  },
);
