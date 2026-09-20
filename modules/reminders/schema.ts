import { z } from "zod";
import {
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredId,
  requiredText,
} from "@/lib/forms";

export const REMINDER_TYPES = [
  "VACCINATION_DUE",
  "CHECKUP",
  "FOLLOWUP",
  "BIRTHDAY",
  "CUSTOM",
] as const;

export const REMINDER_STATUSES = [
  "PENDING",
  "SENT",
  "ACKNOWLEDGED",
  "DISMISSED",
] as const;

export const reminderSchema = z.object({
  clientId: requiredId("error.entity.client"),
  petId: optionalText(40),
  type: requiredEnum(REMINDER_TYPES),
  title: requiredText(1, 120, "reminder.name"),
  body: optionalText(1000),
  dueAt: requiredDateTime,
});

export type ReminderInput = z.infer<typeof reminderSchema>;
