import { z } from "zod";
import {
  optionalText,
  requiredEmail,
  requiredEnum,
  requiredText,
} from "@/lib/forms";

// Roles a clinic admin can assign to staff, mirroring Prisma's UserRole.
export const USER_ROLES = [
  "ADMIN",
  "VETERINARIAN",
  "VET_TECH",
  "RECEPTIONIST",
] as const;

const password = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length >= 8, "Şifre en az 8 karakter olmalı.")
  .refine((v) => v.length <= 100, "Şifre en fazla 100 karakter olabilir.");

export const staffSchema = z.object({
  name: requiredText(1, 100, "Ad"),
  email: requiredEmail,
  role: requiredEnum(USER_ROLES),
  phone: optionalText(40),
  password,
});

export type StaffInput = z.infer<typeof staffSchema>;
