import { z } from "zod";
import {
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredText,
} from "@/lib/forms";

export const DIAGNOSTIC_TYPES = [
  "BLOOD",
  "URINE",
  "FECAL",
  "CYTOLOGY",
  "CULTURE",
  "XRAY",
  "ULTRASOUND",
  "MRI",
  "CT",
  "ECG",
  "ENDOSCOPY",
  "OTHER",
] as const;

export const diagnosticSchema = z.object({
  petId: z.string().min(1, "Hasta seç."),
  visitId: optionalText(40),
  type: requiredEnum(DIAGNOSTIC_TYPES),
  name: requiredText(1, 120, "Test adı"),
  performedAt: requiredDateTime,
  result: optionalText(5000),
  interpretation: optionalText(5000),
  notes: optionalText(2000),
});

export type DiagnosticInput = z.infer<typeof diagnosticSchema>;
