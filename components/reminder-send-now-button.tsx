"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

/**
 * Send this reminder's message now, instead of waiting for the sweep.
 *
 * Why it exists at all: the sweep runs on a cron, so the moment where a vet
 * sees that reminders actually go out never arrives on a machine where no
 * cron runs. The delivery sentence next to this button can promise
 * "tomorrow at 09:00" honestly and still leave the feature looking like a
 * filing cabinet. This closes the loop in one click, and the sentence
 * afterwards is the proof.
 *
 * It is not a second, looser path into the provider: the server action runs
 * the same composition, the same consent/phone/channel gates and the same
 * duplicate guard the sweep runs, so a reminder that the sweep would refuse
 * is refused here too. The one difference is on purpose — the audit row
 * carries the person who pressed it, where the sweep's carries nobody.
 */
export function ReminderSendNowButton({
  action,
  label,
  name,
}: {
  /** Bound to the reminder id on the server. */
  action: () => Promise<FormState>;
  /** What the button reads. Short, because the row is dense. */
  label: string;
  /**
   * What it is called out loud. Ten rows carry ten buttons reading "Send
   * now"; by voice they are the same button ten times over (TEAM.md #26).
   */
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        // Two kinds of failure end up here and they need different
        // treatment. A provider rejection has already written a FAILED
        // `MessageLog` row, so the delivery sentence will say what went
        // wrong once the page catches up; a refusal before that point
        // (permission, the reminder no longer pending) changes nothing
        // on screen at all. The toast is what makes the second kind
        // visible, and a soft refresh is used here rather than a reload
        // so the toast survives long enough to be read.
        toast.error(result.error);
        router.refresh();
        return;
      }
      // Nothing is toasted on success on purpose: the row itself is about
      // to read "Sent: <time> · SMS", which says more than a toast and
      // stays on screen. A full reload and not `router.refresh()` for the
      // reason `use-refresh-action.ts` documents at length — the soft path
      // stalled about one click in three on this page, and a send that
      // looks like it did not happen is the exact complaint this work
      // exists to answer.
      window.location.reload();
    });
  }

  return (
    <Button
      type="button"
      // `secondary`, where the same action on the appointment page is the
      // primary button. A deliberate departure from "same action, same
      // appearance" (TEAM.md #18) and the reason is the list: there the
      // card has one send and it is what the card is for, here every row
      // would carry a filled button and twenty of them read as twenty
      // demands. The action, the icon and the wording are unchanged; only
      // the weight is, and the weight is what the list is about.
      variant="secondary"
      size="sm"
      // `aria-busy` rather than `disabled`: a control disabled under the
      // user's finger loses focus to `body` and does not get it back
      // (`submit-button.tsx`). The second press is still ignored.
      aria-busy={pending || undefined}
      aria-label={name}
      onClick={() => !pending && send()}
    >
      <Send />
      {label}
    </Button>
  );
}
