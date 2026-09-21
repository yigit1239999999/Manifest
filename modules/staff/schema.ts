import { z } from "zod";
import {
  optionalPhone,
  password,
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

export const staffSchema = z.object({
  name: requiredText(1, 100, "staff.name"),
  email: requiredEmail,
  role: requiredEnum(USER_ROLES),
  phone: optionalPhone(40),
  password: password("staff.password"),
});

export type StaffInput = z.infer<typeof staffSchema>;
