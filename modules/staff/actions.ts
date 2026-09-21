"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { action, parse, type FormState } from "@/lib/action";
import { staffSchema } from "./schema";
import { createStaff, setStaffActive } from "./service";

export const createStaffAction = action(
  "staff.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(staffSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createStaff(parsed.data, ctx);
    revalidatePath("/staff");
    redirect("/staff");
  },
);

// Returns a state rather than nothing: refusing to deactivate the last
// administrator has to reach the screen, and a void action has nowhere to
// put the message. The list is refreshed on the client after the result
// arrives (see StaffStatusButton) — calling revalidatePath here would race
// that transition and leave the button pending.
export const setStaffActiveAction = action(
  "staff.setActive",
  async (ctx, id: string, active: boolean): Promise<FormState> => {
    await setStaffActive(id, active, ctx);
    return { success: true };
  },
);
