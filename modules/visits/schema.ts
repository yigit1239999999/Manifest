import { z } from "zod";
import {
  optionalDateTime,
  optionalFloat,
  optionalInt,
  optionalMoneyCents,
  optionalText,
  requiredDateTime,
  requiredEnum,
} from "@/lib/forms";
import { VISIT_TYPES } from "@/modules/appointments/schema";

export const visitSchema = z.object({
  petId: z.string().min(1, "Hasta seç."),
  vetId: optionalText(40),
  visitedAt: requiredDateTime,
  type: requiredEnum(VISIT_TYPES),
  chiefComplaint: optionalText(500),
  subjective: optionalText(5000),
  objective: optionalText(5000),
  assessment: optionalText(5000),
  plan: optionalText(5000),
  weightKg: optionalFloat({ min: 0, max: 1000 }),
  temperatureC: optionalFloat({ min: 25, max: 50 }),
  heartRateBpm: optionalInt({ min: 0, max: 1000 }),
  respiratoryRateBpm: optionalInt({ min: 0, max: 500 }),
  followupAt: optionalDateTime,
  totalCents: optionalMoneyCents,
});

export type VisitInput = z.infer<typeof visitSchema>;
