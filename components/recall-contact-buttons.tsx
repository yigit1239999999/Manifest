"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, PhoneMissed } from "lucide-react";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

type Outcome = "CALLED" | "UNREACHABLE";

/**
 * "Arandı" and "Ulaşılamadı" on one recall row.
 *
 * Each tap adds an attempt -- who, when, what came of it -- rather than
 * setting a flag, because the vet's question is "kime yazıldı, kim
 * dönmedi" and the third unanswered call is a different fact from the
 * first. The toast takes back the one just made, for the thumb that
 * landed on the neighbouring row.
 */
export function RecallContactButtons({
  record,
  remove,
  labels,
}: {
  record: (outcome: Outcome) => Promise<FormState & { contactId?: string }>;
  remove: (contactId: string) => Promise<FormState>;
  labels: {
    called: string;
    unreachable: string;
    calledFor: string;
    unreachableFor: string;
    markedCalled: string;
    markedUnreachable: string;
    undo: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mark(outcome: Outcome) {
    startTransition(async () => {
      const result = await record(outcome);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const id = result?.contactId;
      toast.success(
        outcome === "CALLED" ? labels.markedCalled : labels.markedUnreachable,
        id
          ? {
              action: {
                label: labels.undo,
                onClick: () =>
                  startTransition(async () => {
                    const undone = await remove(id);
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
        aria-label={labels.calledFor}
        onClick={() => !pending && mark("CALLED")}
      >
        <PhoneCall />
        {labels.called}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-busy={pending || undefined}
        aria-label={labels.unreachableFor}
        onClick={() => !pending && mark("UNREACHABLE")}
      >
        <PhoneMissed />
        {labels.unreachable}
      </Button>
    </>
  );
}
