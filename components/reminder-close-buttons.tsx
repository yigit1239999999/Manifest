import { Check, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";

/**
 * The two ways a reminder stops being work.
 *
 * Deliberately two buttons and not a dialog asking which: there are exactly
 * two answers here, and a dialog to choose between two is a second click
 * charged for nothing. (The three-way "how did this close?" question that
 * `ConfirmDialog`'s `choices` was drafted for is a different feature and is
 * not this.)
 *
 * No confirmation in front of either, for the reason `RestoreButton` has
 * none: neither destroys anything, both are visible in the "Closed" filter
 * afterwards, and both are undone by the status changing again. Asking
 * before a reversible act charges the user twice (TEAM.md #25).
 *
 * Plain forms rather than handlers, so a row still closes with JavaScript
 * off and so each button gets its own pending state.
 */
export function ReminderCloseButtons({
  acknowledge,
  dismiss,
  acknowledgeLabel,
  dismissLabel,
  acknowledgeName,
  dismissName,
}: {
  acknowledge: (formData: FormData) => Promise<unknown>;
  dismiss: (formData: FormData) => Promise<unknown>;
  /** What the button reads, which is short because the row is dense. */
  acknowledgeLabel: string;
  dismissLabel: string;
  /**
   * What the button is called to a screen reader, which is not short.
   *
   * A list of ten reminders has ten buttons reading "Done" and ten reading
   * "Close", and by voice they are indistinguishable — the user has to
   * count their way back to which row they are on. These say which
   * reminder they belong to (TEAM.md #26).
   */
  acknowledgeName: string;
  dismissName: string;
}) {
  return (
    <>
      <form action={acknowledge as (formData: FormData) => Promise<void>}>
        <SubmitButton variant="secondary" size="sm" aria-label={acknowledgeName}>
          <Check />
          {acknowledgeLabel}
        </SubmitButton>
      </form>
      <form action={dismiss as (formData: FormData) => Promise<void>}>
        <SubmitButton variant="ghost" size="sm" aria-label={dismissName}>
          <X />
          {dismissLabel}
        </SubmitButton>
      </form>
    </>
  );
}
