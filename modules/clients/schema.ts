import { z } from "zod";
import {
  optionalEmail,
  optionalEnum,
  optionalPhone,
  optionalText,
  requiredText,
  tristate,
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
  // Three states, not two: unanswered, yes, no. `checkbox` would collapse
  // the first two -- see `tristate` in `lib/forms.ts`, and the
  // `marketingOptIn` note just below, which is the same trap read from
  // the other end.
  notificationsOptIn: tristate,
  // No `marketingOptIn`. The column still exists and still holds the
  // consents that were collected, but it is not a field of this form any
  // more, and it must not become one by accident: an unticked checkbox
  // submits nothing, so a schema key with no control above it would write
  // `false` over a real consent on every single edit.
  notes: optionalText(2000),
});

export type ClientInput = z.infer<typeof clientSchema>;
