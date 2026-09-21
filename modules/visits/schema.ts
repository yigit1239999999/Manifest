import { z } from "zod";
import {
  optionalDateTime,
  optionalFloat,
  optionalInt,
  optionalMoney,
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredId,
} from "@/lib/forms";
import { VISIT_TYPES } from "@/modules/appointments/schema";

// Built per request: a money field has to be read in the locale the form was
// rendered in, or "12,345" means two different amounts (see lib/money.ts).
export const visitSchema = (locale: string) =>
  z.object({
    petId: requiredId("error.entity.pet"),
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
    // Named for what the user types: an amount. Cents are this app's storage
    // unit and never appear in a form field's name.
    total: optionalMoney(locale),
  });

export type VisitInput = z.infer<ReturnType<typeof visitSchema>>;
