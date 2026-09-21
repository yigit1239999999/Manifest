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
 */
export function intakeFrom(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "");
  const flat = Object.fromEntries(formData) as Record<string, unknown>;
  if (get("newPet[intent]") !== "1") return flat;

  const firstName = get("newOwner[firstName]");
  return {
    ...flat,
    // The picked animal is dropped on purpose: the branch is open, so
    // whatever id is still sitting in the hidden input belongs to a
    // choice the vet has moved on from.
    petId: "",
    newPet: {
      name: get("newPet[name]"),
      species: get("newPet[species]"),
      ownerId: get("newPet[ownerId]"),
      // An owner being written down here, or one already on file --
      // never both. The name is what says which: a picked owner
      // leaves these boxes untouched.
      owner: firstName
        ? {
            firstName,
            lastName: get("newOwner[lastName]"),
            phone: get("newOwner[phone]"),
            consent: get("newOwner[consent]"),
          }
        : undefined,
    },
  };
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

