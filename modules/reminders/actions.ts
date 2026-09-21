"use server";

import { action, parse, type FormState } from "@/lib/action";
import { reminderSchema } from "./schema";
import { createReminder, markReminderStatus } from "./service";

export const createReminderAction = action(
  "reminder.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(reminderSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    await createReminder(parsed.data, ctx);
    return { success: true };
  },
);

export const acknowledgeReminderAction = action(
  "reminder.acknowledge",
  async (ctx, id: string): Promise<void> => {
    await markReminderStatus(id, "ACKNOWLEDGED", ctx);
  },
);

export const dismissReminderAction = action(
  "reminder.dismiss",
  async (ctx, id: string): Promise<void> => {
    await markReminderStatus(id, "DISMISSED", ctx);
  },
);

export const reopenReminderAction = action(
  "reminder.reopen",
  async (ctx, id: string): Promise<void> => {
    await markReminderStatus(id, "PENDING", ctx);
  },
);
