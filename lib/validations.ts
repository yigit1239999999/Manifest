import { z } from "zod";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const SPECIES = ["DOG", "CAT", "BIRD", "RABBIT", "REPTILE", "OTHER"] as const;
export const SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const;

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`);

const optionalText = (max = 200) =>
  z.string().trim().max(max, "This value is too long");

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || emailPattern.test(v), "Enter a valid email address");

const requiredEmail = z
  .string()
  .trim()
  .refine((v) => emailPattern.test(v), "Enter a valid email address");

export const signUpSchema = z.object({
  clinicName: requiredText("Clinic name", 100),
  name: requiredText("Your name", 100),
  email: requiredEmail,
  password: z.string().min(8, "Use at least 8 characters").max(100, "Password is too long"),
});

export const signInSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1, "Password is required"),
});

export const ownerSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(200),
  notes: optionalText(2000),
});

export const petSchema = z.object({
  name: requiredText("Name", 80),
  species: z.enum(SPECIES),
  ownerId: z.string().trim().min(1, "Choose a client"),
  breed: optionalText(80),
  sex: z.enum(SEXES),
  birthDate: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  color: optionalText(60),
  weightKg: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) < 1000),
      "Enter a valid weight",
    ),
  microchipId: optionalText(60),
  notes: optionalText(2000),
});

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (map[key] ??= []).push(issue.message);
  }
  return map;
}
