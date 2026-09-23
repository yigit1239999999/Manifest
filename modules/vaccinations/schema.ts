import { z } from "zod";
import {
  optionalDateTime,
  optionalEnum,
  optionalInt,
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
  /**
   * Which dose of the starting series this is, and how long that series
   * was said to be. Both optional and both absent for a vaccine with no
   * series -- which is most of them, and which is why neither may get a
   * default: a "1" written for a vaccine that has no series is a claim
   * about a schedule nobody described.
   *
   * The ceiling is generous rather than tied to the catalogue. A clinic
   * can be recording a series this product does not ship, and a limit
   * that rejected it would turn our list into a rule about their work.
   */
  doseNumber: optionalInt({ min: 1, max: 20 }),
  seriesOf: optionalInt({ min: 1, max: 20 }),
  /**
   * Where the interval behind `nextDueAt` came from. Absent when there is
   * no date, and absent is honest: "nobody said" is exactly what a row
   * with no source means.
   */
  nextDueSource: optionalEnum(["HISTORY", "LIST", "MANUAL"] as const),
  notes: optionalText(1000),
});

export type VaccinationInput = z.infer<typeof vaccinationSchema>;
