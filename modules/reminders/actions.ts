"use server";

import { action, parse, type FormState } from "@/lib/action";
import { reminderSchema } from "./schema";
import { createReminder, markReminderStatus } from "./service";

export const createReminderAction = action(
  "reminder.create",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(reminderSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    // The id travels back so the list can point at the row it just
    // made. `listReminders` orders by due date, so a new reminder can
    // land anywhere -- in the middle of a hundred rows -- and position
    // says nothing about which one is new.
    const reminder = await createReminder(parsed.data, ctx);
    return { success: true, createdId: reminder.id };
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
