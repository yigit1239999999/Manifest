"use client";

import * as React from "react";
import { useActionState } from "react";

/**
 * A form action for a button that changes the page it is on (restore,
 * close, reopen): the server action runs, and once its result has landed
 * the page is loaded again from the server.
 *
 * A full reload, not `router.refresh()`, and not on a hunch. Every way of
 * re-rendering the current page through the client router stalled about
 * one click in three, leaving the record looking unchanged, and each was
 * traced against a production build:
 *
 * - `revalidatePath` inside the action: the result never lands, the button
 *   stays disabled for good (three CI retries, three stalls).
 * - `redirect` back to the same page: the 303 arrives with the page inline
 *   and the router applies nothing.
 * - `router.refresh()`, awaited inside the action or run from an effect
 *   after the result: the refreshed page is fetched and never committed.
 *
 * Navigations to a different page have not stalled once in the same runs,
 * and neither has a plain reload. These three buttons are pressed a few
 * times a day, so a reload is a price nobody will notice. The inline
 * record forms (commit 86f3901) keep `router.refresh()`: their subtree
 * stays on the page, and they have passed every run.
 *
 * The action gets no form data: these buttons carry their argument bound
 * in on the server. What comes back is only a count of completed submits,
 * so the effect runs once per click and not on mount.
 */
export function useRefreshAction(
  action: (formData: FormData) => Promise<unknown>,
): (formData: FormData) => void {
  const [completed, formAction] = useActionState(
    async (previous: number, formData: FormData) => {
      await action(formData);
      return previous + 1;
    },
    0,
  );
  React.useEffect(() => {
    if (completed > 0) window.location.reload();
  }, [completed]);
  return formAction;
}
