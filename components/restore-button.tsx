"use client";

import { ArchiveRestore } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { useRefreshAction } from "@/components/forms/use-refresh-action";

/**
 * Takes a record back out of the archive.
 *
 * The one archive-related action that asks nothing first, and deliberately
 * so: it destroys nothing, it is itself undone by the Archive button next to
 * it, and it exists to repair a mistake. Putting a confirmation in front of
 * "undo" charges the user twice for someone else's slip (TEAM.md #25 — the
 * look of an action matches its consequence, and this one is harmless).
 *
 * A plain form rather than a dialog for the same reason.
 *
 * The page is loaded again once the action has answered (see
 * `useRefreshAction` for why nothing lighter was reliable here).
 */
export function RestoreButton({
  action,
  label,
}: {
  action: (formData: FormData) => Promise<unknown>;
  label: string;
}) {
  const formAction = useRefreshAction(action);
  return (
    <form action={formAction}>
      <SubmitButton variant="secondary" size="sm">
        <ArchiveRestore />
        {label}
      </SubmitButton>
    </form>
  );
}
