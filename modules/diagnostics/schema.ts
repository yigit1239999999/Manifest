import { z } from "zod";
import {
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredId,
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
  petId: requiredId("error.entity.pet"),
  visitId: optionalText(40),
  type: requiredEnum(DIAGNOSTIC_TYPES),
  name: requiredText(1, 120, "diagnostic.name"),
  performedAt: requiredDateTime,
  result: optionalText(5000),
  interpretation: optionalText(5000),
  notes: optionalText(2000),
});

export type DiagnosticInput = z.infer<typeof diagnosticSchema>;
