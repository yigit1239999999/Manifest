import { z } from "zod";
import {
  optionalDateTime,
  optionalInt,
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredText,
} from "@/lib/forms";

export const PRESCRIPTION_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;

export const prescriptionSchema = z.object({
  petId: z.string().min(1, "Hasta seç."),
  visitId: optionalText(40),
  prescribedById: optionalText(40),
  medicationName: requiredText(1, 120, "İlaç adı"),
  dosage: requiredText(1, 80, "Doz"),
  frequency: requiredText(1, 80, "Sıklık"),
  route: optionalText(60),
  durationDays: optionalInt({ min: 0, max: 3650 }),
  refills: optionalInt({ min: 0, max: 50 }),
  startedAt: requiredDateTime,
  endedAt: optionalDateTime,
  status: requiredEnum(PRESCRIPTION_STATUSES),
  instructions: optionalText(2000),
  notes: optionalText(2000),
});

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
