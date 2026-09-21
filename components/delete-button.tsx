"use client";

import { Archive, CalendarX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";

/**
 * A destructive-looking action behind a confirmation.
 *
 * It used to ask with `window.confirm`, which is the browser's dialog, not
 * the app's: it cannot be styled, it cannot be read in the user's language
 * (its two buttons follow the operating system, not the app), it names the
 * origin above the question, and it blocks the whole tab. `ConfirmDialog`
 * asks the same question in the app's own voice.
 *
 * `tone` and `icon` are what the action looks like, and they are separate
 * on purpose. This used to say that telling reversible actions apart from
 * destructive ones was an open design question; it is not any more. pm
 * confirmed in the browser that archiving can be undone, and ux settled it:
 * an archive is `default` with an `Archive` mark, a real deletion keeps
 * `destructive` and the bin (TEAM.md #25, which cuts both ways — dressing
 * a permanent delete quietly is as wrong as dressing an archive as one).
 *
 * The default stays `destructive`: the one true deletion in the app is the
 * one that must not be softened by an oversight.
 *
 * The mark is its own prop rather than derived from the tone, because they
 * do not move together: `tone` says whether an action can be undone, `mark`
 * says what the action is. Cancelling an appointment is `default` and
 * `cancel` — reversible, but nothing is being filed away.
 *
 * It is a name and not the icon itself, and that is load-bearing twice
 * over. This component is `"use client"` and every call site is a server
 * component, so a component reference cannot cross the boundary at all —
 * passing `icon={Archive}` compiled, type-checked, passed every test and
 * took four detail pages to the error boundary. And a closed set of names
 * means a call site cannot invent a mark of its own, so "the same action
 * looks the same everywhere" stops being something we check by hand
 * (TEAM.md #18).
 */
const MARKS = {
  delete: Trash2,
  archive: Archive,
  cancel: CalendarX,
} as const;
export function DeleteButton({
  action,
  label,
  confirmText,
  description,
  tone = "destructive",
  mark = "delete",
}: {
  action: (formData: FormData) => Promise<unknown>;
  /** Names the action, on the trigger and on the confirming button. */
  label: string;
  /** The question, as a full sentence. */
  confirmText: string;
  /** What exactly happens, and whether it can be undone. */
  description?: string;
  tone?: "destructive" | "default";
  /** What the trigger is marked with. Defaults to the bin, for a real
   * deletion. */
  mark?: keyof typeof MARKS;
}) {
  const tCommon = useTranslations("common");
  const Icon = MARKS[mark];

  return (
    <ConfirmDialog
      title={confirmText}
      description={description}
      confirmLabel={label}
      // Not `common.cancel`: on an appointment the confirming button already
      // reads "Cancel the appointment", and two buttons that both say
      // "Cancel" is a coin toss.
      cancelLabel={tCommon("nevermind")}
      tone={tone}
      action={action}
    >
      {(open) => (
        <button
          type="button"
          onClick={open}
          className={buttonVariants({
            variant: tone === "destructive" ? "destructive" : "secondary",
            size: "md",
          })}
        >
          <Icon />
          {label}
        </button>
      )}
    </ConfirmDialog>
  );
}
