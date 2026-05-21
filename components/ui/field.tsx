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
  const hasError = Boolean(error?.length);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && !hasError && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {hasError && (
        <p className="text-xs font-medium text-destructive">{error?.[0]}</p>
      )}
    </div>
  );
}
