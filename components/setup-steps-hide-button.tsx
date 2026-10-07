"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";
import { Button } from "@/components/ui/button";

/** Closes the next-steps card, with the way back in the toast. */
export function SetupStepsHideButton({
  action,
  label,
  hiddenLabel,
  undoLabel,
}: {
  action: (hidden: boolean) => Promise<FormState>;
  label: string;
  hiddenLabel: string;
  undoLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(hidden: boolean) {
    startTransition(async () => {
      const result = await action(hidden);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (hidden) {
        toast.success(hiddenLabel, { action: { label: undoLabel, onClick: () => set(false) } });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-busy={pending || undefined}
      onClick={() => !pending && set(true)}
    >
      {label}
    </Button>
  );
}
