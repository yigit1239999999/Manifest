import { z } from "zod";
import {
  checkbox,
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
  /**
   * Where the result came from, which decides whether it joins the
   * unread loop. A fact the person entering it already knows, not a
   * judgement about whether somebody ought to read it.
   */
  externalLab: checkbox,
});

export type DiagnosticInput = z.infer<typeof diagnosticSchema>;
