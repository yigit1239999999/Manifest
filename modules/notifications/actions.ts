"use server";

import { action, parse, type FormState } from "@/lib/action";
import type { AppointmentMessageKind } from "@/lib/whatsapp/messages";
import { notificationSettingsSchema } from "./schema";
import {
  logManualMessage,
  sendAppointmentMessage,
  sendReminderNow,
  setNotificationSettings,
} from "./service";

export const setNotificationSettingsAction = action(
  "notifications.setSettings",
  async (ctx, _prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = parse(notificationSettingsSchema, formData);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
    await setNotificationSettings(parsed.data, ctx);
    return { success: true };
  },
);

export const sendAppointmentMessageAction = action(
  "notifications.sendAppointmentMessage",
  async (ctx, appointmentId: string, kind: AppointmentMessageKind): Promise<FormState> => {
    await sendAppointmentMessage(appointmentId, kind, ctx);
    return { success: true };
  },
);

export const logManualMessageAction = action(
  "notifications.logManual",
  async (ctx, appointmentId: string, kind: AppointmentMessageKind): Promise<FormState> => {
    await logManualMessage(appointmentId, kind, ctx);
    return { success: true };
  },
);

/**
 * "Send now" on a reminder row. Returns a state rather than redirecting,
 * so the list refreshes in place -- and so no `revalidatePath` runs here:
 * on an action that returns a value it races the client transition and
 * leaves the button spinning.
 */
export const sendReminderNowAction = action(
  "notifications.sendReminderNow",
  async (ctx, reminderId: string): Promise<FormState> => {
    await sendReminderNow(reminderId, ctx);
    return { success: true };
  },
);
