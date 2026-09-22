"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface Props {
  /** The field the number is written into (`phone`, `newOwner[phone]`). */
  name: string;
  /** The tick beside it, which is never a column (`clientSchema`). */
  laterName: string;
  label: string;
  hint: string;
  laterLabel: string;
  error?: string[];
  defaultValue?: string | null;
  /**
   * Whether the tick opens marked.
   *
   * True for a record that is already on file WITHOUT a number: the
   * absence is a fact the form has to be able to show and re-save, or
   * a client opened to correct an address is held hostage by a field
   * nobody can fill. A new record opens unmarked, because nobody has
   * been asked yet.
   */
  defaultLater?: boolean;
}

/**
 * The telephone, and the one way past it.
 *
 * The number is what the clinic finds the animal by afterwards and what
 * every reminder is sent to, so this field argues harder than any other
 * on the counter's forms. It is still not `required`, and the reason is
 * the vet's: an owner who will not give a number produces a made-up one
 * in a box that cannot be left empty. That is the defect `lastName` was
 * moved for, and `notificationsOptIn` after it -- absent is a fact, not
 * an omission, and the product now knows the fact in three places.
 *
 * The tick rather than a plain empty box, because an empty box cannot
 * tell "there is no number" from "I have not got there yet", and the
 * second one is a mistake worth catching. It writes nothing anywhere:
 * `Client.phone` is nullable and the empty column IS the record.
 *
 * ONE WAY, and this is the whole of the interaction. A number typed in
 * takes the tick off, because a ticked box under a full field says two
 * things at once and the reader cannot tell which one the record will
 * get (the schema can: the number wins). The reverse does not happen --
 * clearing the field leaves the tick alone, because a box that ticks
 * itself while somebody is mid-correction moves under their hands.
 * Ticking is always the reader's act.
 *
 * A component rather than a copy, for the reason `ConsentChoice` is
 * one: the rule is three lines and the second copy is where one of them
 * goes missing. Both counters ask this -- the client's own form, and
 * the owner written down inside a visit.
 */
export function PhoneOrNone({
  name,
  laterName,
  label,
  hint,
  laterLabel,
  error,
  defaultValue,
  defaultLater = false,
}: Props) {
  const later = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <Field label={label} error={error} hint={hint}>
        <Input
          name={name}
          type="tel"
          defaultValue={defaultValue ?? ""}
          autoComplete="tel"
          // `onInput`, not a blur: the contradiction has to go the
          // moment it stops being true, not when the reader leaves the
          // field. Written straight to the DOM because both controls
          // here are uncontrolled -- `ActionForm` puts a rejected
          // submission back the same way.
          onInput={(e) => {
            const box = later.current;
            if (box?.checked && e.currentTarget.value !== "") {
              box.checked = false;
            }
          }}
        />
      </Field>
      {/* `py-1` makes the label 28px tall, which is what WCAG 2.5.8
          asked of the consent radios below it and is the same target. */}
      <label className="flex w-fit items-center gap-2 py-1 text-sm text-foreground">
        <input
          ref={later}
          type="checkbox"
          name={laterName}
          defaultChecked={defaultLater}
          className="size-4"
        />
        {laterLabel}
      </label>
    </>
  );
}
