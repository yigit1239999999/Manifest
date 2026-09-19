"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";

/**
 * Standard follow-up for a server action that returns FormState while the
 * user stays on the page: toast, optional callback, then refresh the route.
 *
 * The refresh happens here, on the client, after the action result has
 * landed, rather than through revalidatePath inside the action. A
 * revalidation-triggered router refresh races the useActionState transition
 * and can leave the form stuck in "pending" (reproduced on roughly one submit
 * in three), which is exactly what made inline records look un-saveable.
 */
export function useActionResult(
  state: FormState,
  { successMessage, onSuccess }: { successMessage?: string; onSuccess?: () => void } = {},
) {
  const router = useRouter();
  const seen = useRef<FormState>(state);
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.success) {
      onSuccess?.();
      if (successMessage) toast.success(successMessage);
      router.refresh();
    }
    if (state.error) toast.error(state.error);
  }, [state, router, successMessage, onSuccess]);
}
