"use server";

import { action, parse, type FormState } from "@/lib/action";
import type { AppointmentMessageKind } from "@/lib/whatsapp/messages";
import { notificationSettingsSchema } from "./schema";
import {
  logManualMessage,
  sendAppointmentMessage,
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
