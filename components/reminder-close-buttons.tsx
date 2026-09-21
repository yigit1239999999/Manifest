import { Check, RotateCcw, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";

/**
 * The two ways a reminder stops being work, and the one way back.
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
 *
 * `reopen` is what makes the rest of this true. "Both are undone by the
 * status changing again" was a claim about the service, not about anyone
 * using the app: until this existed, a reminder closed by mistake was
 * closed for good, and the argument for skipping the confirmation rested
 * on a way back that only the database had. Archiving learned the same
 * thing the expensive way (backlog 39).
 */
export function ReminderCloseButtons({
  acknowledge,
  dismiss,
  reopen,
  acknowledgeLabel,
  dismissLabel,
  reopenLabel,
  acknowledgeName,
  dismissName,
  reopenName,
}: {
  /** Absent on a closed row, where the only move left is to reopen it. */
  acknowledge?: (formData: FormData) => Promise<unknown>;
  dismiss?: (formData: FormData) => Promise<unknown>;
  /** Absent on an open row, which has nothing to come back from. */
  reopen?: (formData: FormData) => Promise<unknown>;
  /** What the button reads, which is short because the row is dense. */
  acknowledgeLabel: string;
  dismissLabel: string;
  reopenLabel: string;
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
  reopenName: string;
}) {
  return (
    <>
      {acknowledge && (
        <form action={acknowledge as (formData: FormData) => Promise<void>}>
          <SubmitButton
            variant="secondary"
            size="sm"
            aria-label={acknowledgeName}
          >
            <Check />
            {acknowledgeLabel}
          </SubmitButton>
        </form>
      )}
      {dismiss && (
        <form action={dismiss as (formData: FormData) => Promise<void>}>
          <SubmitButton variant="ghost" size="sm" aria-label={dismissName}>
            <X />
            {dismissLabel}
          </SubmitButton>
        </form>
      )}
      {reopen && (
        <form action={reopen as (formData: FormData) => Promise<void>}>
          <SubmitButton variant="ghost" size="sm" aria-label={reopenName}>
            <RotateCcw />
            {reopenLabel}
          </SubmitButton>
        </form>
      )}
    </>
  );
}
