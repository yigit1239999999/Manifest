"use client";

import * as React from "react";
import { surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

// Built on the native <dialog> so the platform provides the modal behaviour
// that is easy to get subtly wrong by hand: focus is trapped while open,
// Escape closes it, the backdrop sits in the top layer above every stacking
// context, and focus returns to the trigger on close.

// A plain string, not a `cva`: there is one panel and there are no
// variants of it. Wrapping a constant in a variant builder reads as though
// a second look is coming.
const panelClassName = cn(
  surface,
  // The shadow is the dialog's own: it floats above the page, which a card
  // does not.
  "w-full max-w-sm p-5 text-card-foreground shadow-lg backdrop:bg-black/40",
);

interface ConfirmDialogProps {
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
  /**
   * Called when the user confirms — called, not submitted.
   *
   * The dialog holds no fields, so the `FormData` it passes is always
   * empty; it is there because every call site binds a server action whose
   * last parameter is one. A dialog that needs a value closes over it
   * (`clinic-settings-form` does) rather than expecting to find it here.
   *
   * A returned error state is not handled: the call sites that can fail
   * either report it themselves before returning (`staff-status-button`)
   * or report it on the page they return to.
   */
  action: (formData: FormData) => Promise<unknown>;
  /**
   * Load the page again once the action has answered, instead of closing
   * the dialog and expecting the page to re-render itself.
   *
   * For an action that changes the page it is on (archive, cancel, void,
   * delete a species) and stays there. Re-rendering the current page
   * through the client router, whether by `revalidatePath` in the action
   * or `router.refresh()` after it, stalled about one confirm in three
   * with the record looking unchanged; the traces and the alternatives
   * tried are recorded in `components/forms/use-refresh-action.ts`.
   * A reload has not stalled once.
   */
  reloadAfter?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  children,
  action,
  reloadAfter = false,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const open = React.useCallback(() => ref.current?.showModal(), []);
  const close = React.useCallback(() => ref.current?.close(), []);
  const [pending, startTransition] = React.useTransition();

  // The dialog closes once the action has finished rather than on click:
  // closing first would take the pending state off screen with it, and a
  // redirecting action leaves the page anyway. An action that returns an
  // error state is not handled here — the three call sites that can fail
  // report through the page they return to.
  const confirm = React.useCallback(() => {
    startTransition(async () => {
      await action(new FormData());
      if (reloadAfter) {
        window.location.reload();
        return;
      }
      ref.current?.close();
    });
  }, [action, reloadAfter]);

  return (
    <>
      {/* `open` only reads the ref when it is called, on click — never during
          render. The compiler cannot see through the render prop, so the rule
          is silenced here rather than restructuring around a native <dialog>,
          whose modality and focus trap are the reason for using it. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {children(open)}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={panelClassName}
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
            {/* A button, not a form, and the difference was a release
                blocker. This used to submit its own `<form action=…>`,
                which works only while the dialog is outside every other
                form — and the clinic settings put it inside one. Nested
                forms are invalid HTML: the browser flattens them, the
                inner action never runs, and the currency setting silently
                did nothing at all. Calling the action directly has no such
                condition attached.

                Disabled while it runs, because a confirmation nobody can
                click twice is the cheapest place to stop a double submit
                (see `createAppointment`, which had to solve the same thing
                after the fact). */}
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className={buttonVariants({
                variant: tone === "destructive" ? "destructive" : "primary",
                size: "md",
              })}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
