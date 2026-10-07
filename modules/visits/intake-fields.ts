// The contract between the intake form's field names and the schema.
//
// Kept out of `actions.ts` so it can be read by a test without
// dragging a server action -- and because it is an agreement between
// two people working in two files, which is exactly the kind of thing
// that drifts when it lives inside something else.

import type { ZodError } from "zod";

/**
 * How the intake form's fields arrive, and why they are bracketed.
 *
 * A form submits a flat list of names; the schema wants the animal and
 * its owner nested, because "a new animal, with an owner already on
 * file" and "a new animal and a new owner" are different shapes and a
 * flat object cannot say which one it is. The bracket convention is
 * the one `InvoiceForm` already uses for its lines, and the same
 * reading happens here: the ACTION assembles, the schema validates.
 *
 * `newPet[intent]` is what says the vet chose to create rather than to
 * pick. Without it, an empty branch left on screen by a rejected
 * submit would be indistinguishable from no branch at all -- and a
 * stale `petId` underneath would quietly win.
 *
 * `newOwner[intent]` says the same thing one branch in, and it is a
 * field for a reason the first version of this file got wrong: the
 * owner branch used to be inferred from the first name being
 * non-empty. That reads an empty box as a closed branch, so a vet who
 * cleared the name was told to "select an owner" under a picker they
 * had deliberately stepped past, instead of being told the name is
 * required under the box it is missing from. An intent cannot be
 * cleared by typing.
 */
export function intakeFrom(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "");
  const flat = Object.fromEntries(formData) as Record<string, unknown>;
  if (get("newPet[intent]") !== "1") return flat;

  const writingOwner = get("newOwner[intent]") === "1";
  return {
    ...flat,
    // The picked animal is dropped on purpose: the branch is open, so
    // whatever id is still sitting in the hidden input belongs to a
    // choice the vet has moved on from.
    petId: "",
    newPet: {
      name: get("newPet[name]"),
      species: get("newPet[species]"),
      // And the picked owner goes the same way for the same reason,
      // one branch in. An owner being written down, or one already on
      // file -- never both.
      ownerId: writingOwner ? "" : get("newPet[ownerId]"),
      owner: writingOwner
        ? {
            firstName: get("newOwner[firstName]"),
            lastName: get("newOwner[lastName]"),
            phone: get("newOwner[phone]"),
            // An unticked box submits nothing, so this arrives as "".
            // `checkbox` reads that as off, which is what it is.
            phoneLater: get("newOwner[phoneLater]"),
            consent: get("newOwner[consent]"),
          }
        : undefined,
    },
  };
}

/**
 * The service's field names, translated to the ones on screen.
 *
 * `createVisitWithIntake` refuses an owner from another clinic with
 * `validationFailed({ ownerId: ... })`, and there is no `ownerId` on
 * this form -- the box is called `newPet[ownerId]`. The message would
 * land in the form-level box with no way back to the control it is
 * about, which is the same defect `namedErrors` exists to prevent,
 * arriving from the other direction.
 *
 * Translated here rather than renamed there: the service answers three
 * screens and must not learn the field names of any of them. A name
 * this map does not know is passed through untouched -- a message in
 * the wrong place is bad, a message nowhere is worse.
 */
const SCREEN_NAMES: Record<string, string> = {
  ownerId: "newPet[ownerId]",
};

export function onScreen(
  fieldErrors: Record<string, string[]>,
): Record<string, string[]> {
  const named: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    named[SCREEN_NAMES[field] ?? field] = messages;
  }
  return named;
}

/**
 * Field errors under the names the form actually rendered.
 *
 * `zodToFieldErrors` keys on the first path segment, which would file
 * every complaint about the new animal under "newPet" -- a field that
 * does not exist on screen. The error would then land in the
 * form-level box with no way back to the control it is about, and the
 * summary's "go to field" button is built from these keys
 * (`action-form.tsx`), so they have to BE the input names.
 *
 * The owner is the one place where the path and the name disagree:
 * the schema nests it under the animal, because an owner written down
 * here belongs to the animal being created, while the form calls it
 * `newOwner[...]` because on screen it is a block of its own.
 */
export function namedErrors(error: ZodError): Record<string, string[]> {
  const named: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [head, second, third] = issue.path as string[];
    const key =
      head === "newPet" && second === "owner" && third
        ? `newOwner[${third}]`
        : head === "newPet" && second
          ? `newPet[${second}]`
          : (head ?? "_form");
    (named[key] ??= []).push(issue.message);
  }
  return named;
}

