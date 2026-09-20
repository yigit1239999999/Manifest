import { z } from "zod";
import {
  optionalDateTime,
  optionalText,
  requiredDateTime,
  requiredId,
  requiredText,
} from "@/lib/forms";

export const vaccinationSchema = z.object({
  petId: requiredId("error.entity.pet"),
  visitId: optionalText(40),
  administeredById: optionalText(40),
  name: requiredText(1, 120, "vaccination.name"),
  manufacturer: optionalText(120),
  lotNumber: optionalText(80),
  site: optionalText(60),
  administeredAt: requiredDateTime,
  nextDueAt: optionalDateTime,
  notes: optionalText(1000),
});

export type VaccinationInput = z.infer<typeof vaccinationSchema>;
