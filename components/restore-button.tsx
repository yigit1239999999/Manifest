"use client";

import { ArchiveRestore, RotateCcw } from "lucide-react";
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
const marks = {
  archive: ArchiveRestore,
  /**
   * Undoing something that was closed rather than filed away.
   *
   * `RotateCcw` because that is already what "put this back" looks like
   * on a reminder row (`reminder-close-buttons.tsx`), and the same act
   * should not arrive wearing two faces. A union rather than an icon
   * prop for the reason `DeleteButton` carries one: a server page
   * cannot hand a component to a client component, and closing the set
   * is also what keeps one meaning to one mark.
   */
  undo: RotateCcw,
} as const;

export function RestoreButton({
  action,
  label,
  name,
  mark = "archive",
}: {
  action: (formData: FormData) => Promise<unknown>;
  label: string;
  /**
   * What it is called out loud, when the label alone would not say
   * which row it belongs to. A page listing ten vaccinations would
   * otherwise carry ten buttons reading "Undo".
   */
  name?: string;
  mark?: keyof typeof marks;
}) {
  const formAction = useRefreshAction(action);
  const Mark = marks[mark];
  return (
    <form action={formAction}>
      <SubmitButton variant="secondary" size="sm" aria-label={name}>
        <Mark />
        {label}
      </SubmitButton>
    </form>
  );
}
