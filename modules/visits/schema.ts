import { z } from "zod";
import {
  checkbox,
  msg,
  optionalDateTime,
  optionalFloat,
  optionalInt,
  optionalMoney,
  optionalPhone,
  optionalText,
  requiredDateTime,
  requiredEnum,
  requiredId,
  requiredText,
  tristate,
} from "@/lib/forms";
import { VISIT_TYPES } from "@/modules/appointments/schema";

// Built per request: a money field has to be read in the locale the form was
// rendered in, or "12,345" means two different amounts (see lib/money.ts).
export const visitSchema = (locale: string) =>
  z.object({
    petId: requiredId("error.entity.pet"),
    vetId: optionalText(40),
    visitedAt: requiredDateTime,
    type: requiredEnum(VISIT_TYPES),
    chiefComplaint: optionalText(500),
    subjective: optionalText(5000),
    objective: optionalText(5000),
    assessment: optionalText(5000),
    plan: optionalText(5000),
    weightKg: optionalFloat({ min: 0, max: 1000 }),
    temperatureC: optionalFloat({ min: 25, max: 50 }),
    heartRateBpm: optionalInt({ min: 0, max: 1000 }),
    respiratoryRateBpm: optionalInt({ min: 0, max: 500 }),
    followupAt: optionalDateTime,
    // Named for what the user types: an amount. Cents are this app's storage
    // unit and never appear in a form field's name.
    total: optionalMoney(locale),
  });

export type VisitInput = z.infer<ReturnType<typeof visitSchema>>;

/**
 * The animal, and its owner, recorded in the same breath as the visit.
 *
 * The vet's sentence for why this exists: "a form has no order, a walk
 * does." At the counter the owner is standing there and the animal is
 * not on file; on the examination table the animal is in front of them
 * and the owner is a name they have not asked for yet. The product
 * asked for whichever one they did not have, first.
 *
 * So these are the fields that may be answered inside the visit form
 * rather than on a screen of their own -- and the list is short on
 * purpose. The vet was asked what else has to be captured while the
 * animal is on the table and answered that there is nothing: "there is
 * no field I would say you must ask me now or I can never enter it."
 * Breed, birth date, sex, address, email and the surname are all
 * absent for that reason, not by oversight, and adding one here is a
 * decision about the vet's hands rather than about the schema.
 */
export const newOwnerSchema = z
  .object({
    firstName: requiredText(1, 80, "client.firstName"),
    // Absent is a fact, not an omission: the counter is not allowed to
    // ask the lady who brings the street cat (`Client.lastName`).
    lastName: optionalText(80),
    // The clinic's only handle on the animal afterwards, and what every
    // reminder is sent to -- and, since the animal is on the table while
    // this is being typed, the one the counter is least likely to have.
    // Required unless `phoneLater` says out loud that there is none.
    phone: optionalPhone(40),
    // Says "there is no number to take", and writes nothing anywhere.
    // The same reasoning as `clientSchema.phoneLater`, which is the
    // sibling of this field on the form that has a screen of its own.
    phoneLater: checkbox,
    // Three states and nothing pre-selected. "Do not ask now" writes
    // NOTHING -- `null`, the same value a client born unasked carries --
    // because "I asked and got no answer" and "I never asked" change
    // neither what the product sends nor what it has to ask again.
    //
    // Named for the question rather than for the column: the screen is
    // not allowed to say "notification permission" anywhere, so a form
    // field carrying that word would move retired jargon to a fresh
    // surface. `Client.notificationsOptIn` keeps its name.
    consent: tristate,
  })
  // Under `phone`, which reaches the form as `newOwner[phone]`
  // (`namedErrors`) -- the box the reader is looking at, not the tick
  // that lets them past it.
  .superRefine((value, ctx) => {
    if (!value.phone && !value.phoneLater) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: msg("error.form.phoneOrLater"),
      });
    }
  })
  // Dropped here rather than in the service, so that the one place
  // that knows this field is not a column is the one place that
  // describes it. `createVisitWithIntake` writes the owner's row from
  // named fields, but its audit entry redacts the whole object.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- named so it can be dropped
  .transform(({ phoneLater, ...rest }) => rest);

export const newPetSchema = z.object({
  name: requiredText(1, 80, "pet.name"),
  /** Built-in key, `custom:<id>`, or a typed name: see `resolveSpecies`. */
  species: requiredText(1, 60, "pet.species"),
  /** An owner already on file... */
  ownerId: optionalText(40),
  /** ...or one being written down in the same breath. Exactly one. */
  owner: newOwnerSchema.optional(),
});

/**
 * A visit that may be bringing its animal, and its animal's owner, with
 * it.
 *
 * Deliberately a second schema rather than a loosened `visitSchema`:
 * editing a visit can never create an animal, and a single schema that
 * allowed it would have to be told which case it was in on every call.
 */
export const visitIntakeSchema = (locale: string) =>
  visitSchema(locale)
    .extend({
      // Relaxed, and the refinement below is what keeps it honest.
      petId: optionalText(40),
      newPet: newPetSchema.optional(),
      // The appointment this visit was started from ("Start visit").
      // Here and not in `visitSchema`: an edit spreads its input into
      // the row, and must not be able to move a visit between
      // appointments. Trusted for nothing -- the service links it only
      // when it is this clinic's, this animal's, and still unanswered.
      appointmentId: optionalText(40).optional(),
    })
    .superRefine((value, ctx) => {
      if (!value.petId && !value.newPet) {
        ctx.addIssue({
          code: "custom",
          path: ["petId"],
          message: msg("error.form.select", { field: "pet.one" }),
        });
      }
      if (value.newPet && !value.newPet.ownerId && !value.newPet.owner) {
        ctx.addIssue({
          code: "custom",
          path: ["newPet", "ownerId"],
          message: msg("error.form.select", { field: "pet.owner" }),
        });
      }
    });

export type NewPetInput = z.infer<typeof newPetSchema>;
export type VisitIntakeInput = z.infer<ReturnType<typeof visitIntakeSchema>>;
