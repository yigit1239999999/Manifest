import { z } from "zod";
import {
  checkbox,
  optionalDate,
  optionalFloat,
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredId,
  requiredText,
} from "@/lib/forms";

export const SPECIES = [
  "DOG",
  "CAT",
  "BIRD",
  "RABBIT",
  "RODENT",
  "FERRET",
  "REPTILE",
  "AMPHIBIAN",
  "FISH",
  "HORSE",
  "CATTLE",
  "SHEEP",
  "GOAT",
  "EXOTIC",
  "OTHER",
] as const;

export const SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const;

export const petSchema = z.object({
  ownerId: requiredId("pet.owner"),
  name: requiredText(1, 80, "pet.name"),
  // Either a built-in Species enum value, "custom:<id>" for an existing
  // clinic-defined species, or free text naming a new one (created by the
  // service). Resolved in `resolveSpecies`.
  species: requiredText(1, 60, "pet.species"),
  breed: optionalText(80),
  sex: requiredEnum(SEXES),
  neutered: checkbox,
  birthDate: optionalDate,
  color: optionalText(60),
  weightKg: optionalFloat({ min: 0, max: 1000 }),
  microchipId: optionalText(60),
  insuranceProvider: optionalText(80),
  insurancePolicy: optionalText(80),
  alerts: optionalText(500),
  notes: optionalText(2000),
});

/** "Vefat etti olarak işaretle": the day, and an optional line. */
export const deceasedSchema = z.object({
  deceasedAt: requiredDateTime,
  deceasedNote: optionalText(500),
});

export type DeceasedInput = z.infer<typeof deceasedSchema>;

export type PetInput = z.infer<typeof petSchema>;
