"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

/**
 * Closes one overdue vaccination row on the dashboard.
 *
 * What it closes is the ROW. The animal is untouched, the vaccination
 * stays on its page, and every other screen is unchanged -- "I have
 * dealt with this one" is a much smaller statement than "this animal
 * is gone", and a card that made the larger one on a click would be a
 * trap the vet only finds later.
 *
 * Reversible, and the toast is the FASTEST way back rather than the
 * only one. The card hides what it closes, so a mis-click on a dense
 * list removes the row and its own way back at the same time, and the
 * toast catches that while the row is still in mind. But it lasts
 * seconds -- pm ran a single query to check the result and returned to
 * find it gone -- so the lasting way back lives on the animal's page,
 * where the vaccination itself lives. Same call in both directions, so
 * undoing costs no extra round trip to work out what was undone.
 */
export function VaccinationDueDismissButton({
  action,
  label,
  name,
  undoLabel,
  undoneLabel,
}: {
  /** Bound to the vaccination id on the server; takes the new state. */
  action: (dismissed: boolean) => Promise<FormState>;
  /** What the button reads. Short: the row is dense. */
  label: string;
  /** What it is called out loud -- ten rows would otherwise carry ten identical buttons. */
  name: string;
  undoLabel: string;
  undoneLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(dismissed: boolean) {
    startTransition(async () => {
      const result = await action(dismissed);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (dismissed) {
        toast.success(undoneLabel, {
          action: { label: undoLabel, onClick: () => set(false) },
        });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      // Quiet on purpose. Every row carries one, and a filled button per
      // row reads as a list of demands rather than a list of work
      // (TEAM.md #18 allows the weight to differ, not the action).
      variant="ghost"
      size="sm"
      aria-busy={pending || undefined}
      aria-label={name}
      onClick={() => !pending && set(true)}
    >
      <Check />
      {label}
    </Button>
  );
}
