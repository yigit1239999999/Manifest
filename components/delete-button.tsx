"use client";

import { Trash2, type LucideIcon } from "lucide-react";
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
 * The icon is its own prop rather than derived from the tone, because they
 * do not move together. Cancelling an appointment is reversible and would
 * be `default`, but an `Archive` mark on it would be a lie.
 */
export function DeleteButton({
  action,
  label,
  confirmText,
  description,
  tone = "destructive",
  icon: Icon = Trash2,
}: {
  action: (formData: FormData) => Promise<unknown>;
  /** Names the action, on the trigger and on the confirming button. */
  label: string;
  /** The question, as a full sentence. */
  confirmText: string;
  /** What exactly happens, and whether it can be undone. */
  description?: string;
  tone?: "destructive" | "default";
  /** The mark on the trigger. Defaults to the bin, for a real deletion. */
  icon?: LucideIcon;
}) {
  const tCommon = useTranslations("common");

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
