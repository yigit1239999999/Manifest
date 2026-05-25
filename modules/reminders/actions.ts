"use server";

import { revalidatePath } from "next/cache";
import { action, parse, type FormState } from "@/lib/action";
import { reminderSchema } from "./schema";
import { createReminder, markReminderStatus } from "./service";

export const createReminderAction = action(
  "reminder.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(reminderSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const reminder = await createReminder(parsed.data, ctx);
    revalidatePath("/reminders");
    revalidatePath(`/clients/${reminder.clientId}`);
    if (reminder.petId) revalidatePath(`/pets/${reminder.petId}`);
    return { success: true };
  },
);

export const acknowledgeReminderAction = action(
  "reminder.acknowledge",
  async (ctx, id: string): Promise<void> => {
    await markReminderStatus(id, "ACKNOWLEDGED", ctx);
    revalidatePath("/reminders");
    revalidatePath("/");
  },
);

export const dismissReminderAction = action(
  "reminder.dismiss",
  async (ctx, id: string): Promise<void> => {
    await markReminderStatus(id, "DISMISSED", ctx);
    revalidatePath("/reminders");
    revalidatePath("/");
  },
);
