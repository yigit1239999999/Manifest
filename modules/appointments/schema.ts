import { z } from "zod";
import {
  optionalInt,
  optionalText,
  requiredDateTime,
  requiredEnum,
} from "@/lib/forms";

export const VISIT_TYPES = [
  "WELLNESS_CHECK",
  "VACCINATION",
  "SICK_VISIT",
  "EMERGENCY",
  "SURGERY",
  "DENTAL",
  "GROOMING",
  "FOLLOWUP",
  "TELEHEALTH",
  "OTHER",
] as const;

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const appointmentSchema = z.object({
  petId: z.string().min(1, "Hasta seç."),
  vetId: optionalText(40),
  startsAt: requiredDateTime,
  durationMinutes: optionalInt({ min: 5, max: 480 }),
  type: requiredEnum(VISIT_TYPES),
  status: requiredEnum(APPOINTMENT_STATUSES),
  reason: optionalText(500),
  notes: optionalText(2000),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
