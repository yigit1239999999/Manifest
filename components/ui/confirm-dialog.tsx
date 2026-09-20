"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Built on the native <dialog> so the platform provides the modal behaviour
// that is easy to get subtly wrong by hand: focus is trapped while open,
// Escape closes it, the backdrop sits in the top layer above every stacking
// context, and focus returns to the trigger on close.

const panelVariants = cva(
  "w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/40",
);

export interface ConfirmDialogProps {
  /** The question, written as a full sentence. */
  title: string;
  /** Optional detail: what exactly happens, and whether it can be undone. */
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * How the confirming action is presented. `destructive` is for changes that
   * cannot be undone; `default` is for reversible ones. An action's appearance
   * has to match its consequence in both directions — a reversible archive
   * dressed as a deletion teaches people to fear it, and a permanent delete
   * dressed quietly does not read as permanent at all.
   */
  tone: "destructive" | "default";
  /** Rendered as the trigger. Receives the handler that opens the dialog. */
  children: (open: () => void) => React.ReactNode;
  /** Submitted when the user confirms. */
  action: (formData: FormData) => Promise<unknown>;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  children,
  action,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const open = React.useCallback(() => ref.current?.showModal(), []);
  const close = React.useCallback(() => ref.current?.close(), []);

  return (
    <>
      {children(open)}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(panelVariants())}
        // Clicking the backdrop is the same intent as pressing Escape. The
        // dialog element itself fills the backdrop area, so a click landing on
        // the element rather than on its contents came from outside the panel.
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {/* Cancel comes first in the DOM and takes focus on open, so the
                default action of a dialog nobody read is the harmless one. */}
            <Button type="button" variant="ghost" onClick={close} autoFocus>
              {cancelLabel}
            </Button>
            <form action={action as (formData: FormData) => Promise<void>}>
              <button
                type="submit"
                className={buttonVariants({
                  variant: tone === "destructive" ? "destructive" : "primary",
                  size: "md",
                })}
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

export type ConfirmDialogTone = VariantProps<typeof panelVariants> &
  Pick<ConfirmDialogProps, "tone">;
