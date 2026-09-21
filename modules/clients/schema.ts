import { z } from "zod";
import {
  checkbox,
  optionalEmail,
  optionalEnum,
  optionalPhone,
  optionalText,
  requiredText,
} from "@/lib/forms";

export const CONTACT_METHODS = ["EMAIL", "PHONE", "SMS"] as const;
export const LANGUAGES = ["tr", "en"] as const;

export const clientSchema = z.object({
  firstName: requiredText(1, 80, "client.firstName"),
  lastName: requiredText(1, 80, "client.lastName"),
  email: optionalEmail,
  phone: optionalPhone(40),
  secondaryPhone: optionalPhone(40),
  address: optionalText(200),
  city: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  preferredContact: optionalEnum(CONTACT_METHODS),
  preferredLanguage: optionalEnum(LANGUAGES),
  notificationsOptIn: checkbox,
  marketingOptIn: checkbox,
  notes: optionalText(2000),
});

export type ClientInput = z.infer<typeof clientSchema>;
