"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, UserX } from "lucide-react";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

type Result = FormState & { previous?: string };

/**
 * "Geldi" and "Gelmedi" on one appointment row.
 *
 * One tap each, because the alternative the vet described was Edit, find
 * the status list, pick, save -- four steps for a fact reception knows
 * the instant the door opens. Reversible from the toast, the same way the
 * overdue row's close is: a dense list is where a thumb lands on the
 * neighbour.
 *
 * "Did not come" is only offered once the hour has passed. The server
 * refuses it before then too (`modules/appointments/arrival.ts`); the
 * button is not drawn because a control that can only fail is worse
 * than none.
 */
export function ArrivalButtons({
  setAction,
  undoAction,
  canMarkNoShow,
  labels,
}: {
  setAction: (status: "ARRIVED" | "NO_SHOW") => Promise<Result>;
  undoAction: (previous: string) => Promise<FormState>;
  canMarkNoShow: boolean;
  labels: {
    arrived: string;
    noShow: string;
    /** Named with the row ("Geldi: Zeytin 10:30"): ten rows are not ten identical buttons by voice. */
    arrivedFor: string;
    noShowFor: string;
    markedArrived: string;
    markedNoShow: string;
    undo: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mark(status: "ARRIVED" | "NO_SHOW") {
    startTransition(async () => {
      const result = await setAction(status);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const previous = result?.previous;
      toast.success(
        status === "ARRIVED" ? labels.markedArrived : labels.markedNoShow,
        previous
          ? {
              action: {
                label: labels.undo,
                onClick: () =>
                  startTransition(async () => {
                    const undone = await undoAction(previous);
                    if (undone?.error) toast.error(undone.error);
                    router.refresh();
                  }),
              },
            }
          : undefined,
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-busy={pending || undefined}
        aria-label={labels.arrivedFor}
        onClick={() => !pending && mark("ARRIVED")}
      >
        <Check />
        {labels.arrived}
      </Button>
      {canMarkNoShow && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-busy={pending || undefined}
          aria-label={labels.noShowFor}
          onClick={() => !pending && mark("NO_SHOW")}
        >
          <UserX />
          {labels.noShow}
        </Button>
      )}
    </>
  );
}
