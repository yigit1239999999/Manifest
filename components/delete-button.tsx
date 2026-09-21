"use client";

import { Trash2 } from "lucide-react";
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
 * `tone` is what the confirmation and the button look like. It defaults to
 * `destructive` because that is what every call site renders today — but
 * most of them archive or cancel, which are reversible, and telling them
 * apart is an open design question, not something to decide by default.
 */
export function DeleteButton({
  action,
  label,
  confirmText,
  description,
  tone = "destructive",
}: {
  action: (formData: FormData) => Promise<unknown>;
  /** Names the action, on the trigger and on the confirming button. */
  label: string;
  /** The question, as a full sentence. */
  confirmText: string;
  /** What exactly happens, and whether it can be undone. */
  description?: string;
  tone?: "destructive" | "default";
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
          <Trash2 />
          {label}
        </button>
      )}
    </ConfirmDialog>
  );
}
