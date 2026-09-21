// One entry point: the right wording for a channel.

import {
  composeAppointmentMessage,
  composeReminderMessage,
  type AppointmentMessageContext,
  type AppointmentMessageKind,
  type ReminderMessageContext,
} from "@/lib/whatsapp/messages";
import { composeAppointmentSms, composeReminderSms } from "./sms-templates";
import type { Channel } from "./types";

export function composeAppointmentFor(
  channel: Channel,
  kind: AppointmentMessageKind,
  ctx: AppointmentMessageContext,
): string {
  return channel === "SMS"
    ? composeAppointmentSms(kind, ctx)
    : composeAppointmentMessage(kind, ctx);
}

export function composeReminderFor(channel: Channel, ctx: ReminderMessageContext): string {
  return channel === "SMS" ? composeReminderSms(ctx) : composeReminderMessage(ctx);
}
