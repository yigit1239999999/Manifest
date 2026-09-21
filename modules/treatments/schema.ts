import { z } from "zod";
import {
  optionalInt,
  optionalText,
  requiredDateTime,
  requiredId,
  requiredText,
} from "@/lib/forms";

export const treatmentSchema = z.object({
  petId: requiredId("error.entity.pet"),
  visitId: optionalText(40),
  performedById: optionalText(40),
  name: requiredText(1, 120, "treatment.name"),
  code: optionalText(40),
  performedAt: requiredDateTime,
  durationMinutes: optionalInt({ min: 0, max: 1440 }),
  notes: optionalText(2000),
});

export type TreatmentInput = z.infer<typeof treatmentSchema>;
