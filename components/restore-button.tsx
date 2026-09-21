import { ArchiveRestore } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";

/**
 * Takes a record back out of the archive.
 *
 * The one archive-related action that asks nothing first, and deliberately
 * so: it destroys nothing, it is itself undone by the Archive button next to
 * it, and it exists to repair a mistake. Putting a confirmation in front of
 * "undo" charges the user twice for someone else's slip (TEAM.md #25 — the
 * look of an action matches its consequence, and this one is harmless).
 *
 * A plain form rather than a dialog for the same reason, which also keeps it
 * working without JavaScript.
 */
export function RestoreButton({
  action,
  label,
}: {
  action: (formData: FormData) => Promise<unknown>;
  label: string;
}) {
  return (
    <form action={action as (formData: FormData) => Promise<void>}>
      <SubmitButton variant="secondary" size="sm">
        <ArchiveRestore />
        {label}
      </SubmitButton>
    </form>
  );
}
