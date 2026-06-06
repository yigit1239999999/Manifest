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

export const setStaffActiveAction = action(
  "staff.setActive",
  async (ctx, id: string, active: boolean): Promise<void> => {
    await setStaffActive(id, active, ctx);
    revalidatePath("/staff");
  },
);
