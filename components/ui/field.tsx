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
  // explicit `htmlFor` they own the wiring; otherwise we generate an id and
  // inject it into the single child control (respecting an id it already has).
  const controlId = htmlFor ?? generatedId;
  const child =
    !htmlFor && React.isValidElement<{ id?: string }>(children)
      ? React.cloneElement(children, { id: children.props.id ?? controlId })
      : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {child}
      {hint && !hasError && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {hasError && (
        <p className="text-xs font-medium text-destructive">{error?.[0]}</p>
      )}
    </div>
  );
}
