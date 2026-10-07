"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/action";

type Bound = (formData: FormData) => Promise<FormState | void>;

/**
 * Reports a refusal, or loads the page again once the answer has landed.
 * A reload rather than `router.refresh()`, for the reason given in
 * `use-refresh-action.ts`.
 */
function useOutcome(action: Bound) {
  const [state, formAction] = useActionState<{ n: number; error?: string }, FormData>(
    async (previous, formData) => {
      const result = await action(formData);
      return { n: previous.n + 1, error: result?.error };
    },
    { n: 0 },
  );
  React.useEffect(() => {
    if (state.n === 0) return;
    if (state.error) toast.error(state.error);
    else window.location.reload();
  }, [state]);
  return formAction;
}

/**
 * "Geldi" / "Gelmedi" on a row of today's list: one tap, where reception
 * is already looking, instead of Edit, the status select and Save.
 *
 * "Gelmedi" is offered only once the hour has started, the same rule the
 * server enforces (`setAppointmentOutcome`). Each button's name carries
 * the animal, because a day's list is a column of identical buttons to
 * anyone listening (TEAM.md #26). 32px tall, side by side, wrapping under
 * the status at 390px.
 */
export function AppointmentOutcomeButtons({
  arrived,
  noShow,
  arrivedLabel,
  noShowLabel,
  arrivedName,
  noShowName,
}: {
  arrived: Bound;
  /** Absent before the start time. */
  noShow?: Bound;
  arrivedLabel: string;
  noShowLabel: string;
  arrivedName: string;
  noShowName: string;
}) {
  const arrivedAction = useOutcome(arrived);
  const noShowAction = useOutcome(noShow ?? (async () => undefined));
  return (
    <div className="flex flex-wrap gap-1.5" data-outcome-buttons="">
      <form action={arrivedAction}>
        <SubmitButton variant="secondary" size="sm" aria-label={arrivedName}>
          <Check />
          {arrivedLabel}
        </SubmitButton>
      </form>
      {noShow && (
        <form action={noShowAction}>
          <SubmitButton variant="ghost" size="sm" aria-label={noShowName}>
            <X />
            {noShowLabel}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
