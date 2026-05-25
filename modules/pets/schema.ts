import { z } from "zod";
import {
  checkbox,
  optionalDate,
  optionalFloat,
  optionalText,
  requiredEnum,
  requiredText,
} from "@/lib/forms";

export const SPECIES = [
  "DOG",
  "CAT",
  "BIRD",
  "RABBIT",
  "RODENT",
  "REPTILE",
  "FISH",
  "EXOTIC",
  "OTHER",
] as const;

export const SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const;

export const petSchema = z.object({
  ownerId: z.string().min(1, "Sahibi seç."),
  name: requiredText(1, 80, "İsim"),
  species: requiredEnum(SPECIES),
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

export type PetInput = z.infer<typeof petSchema>;
