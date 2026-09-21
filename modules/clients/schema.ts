import { z } from "zod";
import {
  checkbox,
  msg,
  optionalEmail,
  optionalEnum,
  optionalPhone,
  optionalText,
  requiredText,
  tristate,
} from "@/lib/forms";

export const CONTACT_METHODS = ["EMAIL", "PHONE", "SMS"] as const;
export const LANGUAGES = ["tr", "en"] as const;

const clientFields = z.object({
  firstName: requiredText(1, 80, "client.firstName"),
  // Optional, and null rather than "" when it is left out: the counter
  // is not allowed to ask the lady who brings the street cat for her
  // surname, and a required field would have produced a full stop.
  // `optionalText` is what turns the empty box into an absence, which
  // is what the column now stores.
  lastName: optionalText(80),
  email: optionalEmail,
  // The clinic's only handle on the animal afterwards, and what every
  // reminder is sent to -- which is why it changed places with the
  // surname above, and why it is still the field this form argues
  // hardest for. What it is no longer is a wall: see `phoneLater`.
  phone: optionalPhone(40),
  // Not a column, and never written to one.
  //
  // The number is required unless somebody says out loud that there is
  // none to take, and that sentence is what this box is. Same shape as
  // the consent question next to it (`tristate`): the control exists so
  // an absence is a thing the counter DECIDED rather than a thing they
  // failed to do, and then it is thrown away -- `Client.phone` is
  // already nullable, so the empty column IS the record of it.
  //
  // Stripped by the transform below rather than passed on, because
  // `createClient` spreads its input straight into Prisma and a key with
  // no column is an error at the database rather than a note.
  phoneLater: checkbox,
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

/**
 * The client as the counter can actually record them.
 *
 * Two fields ask for the same fact and exactly one of them has to
 * answer it. A number that was given wins over a box that says there is
 * none, because the box is a statement about the minute and the number
 * is the fact -- somebody who ticks it and then reads the number out
 * anyway has given us the number.
 *
 * Neither is a real answer and the complaint belongs under the phone
 * field: that is the control the reader is looking at, the box is its
 * escape hatch, and an error filed under `phoneLater` would point at
 * the tick rather than at the work.
 */
export const clientSchema = clientFields
  .superRefine((value, ctx) => {
    if (!value.phone && !value.phoneLater) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: msg("error.form.phoneOrLater"),
      });
    }
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- named so it can be dropped
  .transform(({ phoneLater, ...rest }) => rest);

export type ClientInput = z.infer<typeof clientSchema>;
