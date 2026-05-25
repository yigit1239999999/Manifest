import { z } from "zod";
import {
  optionalDateTime,
  optionalText,
  requiredDateTime,
  requiredText,
} from "@/lib/forms";

export const vaccinationSchema = z.object({
  petId: z.string().min(1, "Hasta seç."),
  visitId: optionalText(40),
  administeredById: optionalText(40),
  name: requiredText(1, 120, "Aşı adı"),
  manufacturer: optionalText(120),
  lotNumber: optionalText(80),
  site: optionalText(60),
  administeredAt: requiredDateTime,
  nextDueAt: optionalDateTime,
  notes: optionalText(1000),
});

export type VaccinationInput = z.infer<typeof vaccinationSchema>;
