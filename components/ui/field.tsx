"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const generatedId = React.useId();
  const hasError = Boolean(error?.length);

  // Associate the label with its control for screen readers (and so tests /
  // tooling can find fields by their label). When the caller passes an
  // explicit `htmlFor` they own the control's id; otherwise we generate one
  // and inject it into the single child control (respecting an id it has).
  const controlId = htmlFor ?? generatedId;

  // Point the control at whichever message is actually on screen, so a screen
  // reader reads "Telefon, geçerli bir numara giriniz" when focus lands on the
  // field. Deliberately NOT a live region: six invalid fields would queue six
  // assertive announcements over each other and none would be understood. The
  // form-level Callout announces "submit failed" once; the per-field detail is
  // read on arrival, in order, by the user's own navigation.
  const errorId = `${generatedId}-error`;
  const hintId = `${generatedId}-hint`;
  const showHint = Boolean(hint) && !hasError;
  const describedBy = hasError ? errorId : showHint ? hintId : undefined;

  type Describable = {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  };

  const child = React.isValidElement<Describable>(children)
    ? React.cloneElement(children, {
        ...(htmlFor ? {} : { id: children.props.id ?? controlId }),
        // Keep anything the control already points at; describedby is a list.
        "aria-describedby":
          [children.props["aria-describedby"], describedBy]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": hasError ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Keep the required "*" OUTSIDE the <label> so it never becomes part
          of the control's accessible name (a label-internal aria-hidden span
          is still picked up by some name computations). */}
      <div className="flex items-center gap-0.5">
        <Label htmlFor={controlId}>{label}</Label>
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {child}
      {showHint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error?.[0]}
        </p>
      )}
    </div>
  );
}
