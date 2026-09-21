"use client";

import type * as React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { useRefreshAction } from "@/components/forms/use-refresh-action";

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
  // One cluster that does not come apart. At 390px the row wrapped into
  // three pieces -- "Send now, Done" and then "Dismiss" alone on the
  // line below -- which reads as an orphan rather than as a pair, and
  // splits a group in the middle of itself. A cluster breaks at a seam
  // in the meaning or not at all: "Send now" reaches outside the clinic,
  // these two close the work, and the seam is between them.
  return (
    <div className="flex items-center gap-2">
      {acknowledge && (
        <RowAction
          action={acknowledge}
          variant="secondary"
          name={acknowledgeName}
          label={acknowledgeLabel}
          icon={<Check />}
        />
      )}
      {dismiss && (
        <RowAction
          action={dismiss}
          variant="ghost"
          name={dismissName}
          label={dismissLabel}
          icon={<X />}
        />
      )}
      {reopen && (
        <RowAction
          action={reopen}
          variant="ghost"
          name={reopenName}
          label={reopenLabel}
          icon={<RotateCcw />}
        />
      )}
    </div>
  );
}

/**
 * One button in its own form, so one pending state is one button. The list
 * is loaded again once the action has answered; see `useRefreshAction`
 * for why nothing lighter was reliable here.
 */
function RowAction({
  action,
  variant,
  name,
  label,
  icon,
}: {
  action: (formData: FormData) => Promise<unknown>;
  variant: "secondary" | "ghost";
  name: string;
  label: string;
  icon: React.ReactNode;
}) {
  const formAction = useRefreshAction(action);
  return (
    <form action={formAction}>
      <SubmitButton variant={variant} size="sm" aria-label={name}>
        {icon}
        {label}
      </SubmitButton>
    </form>
  );
}
