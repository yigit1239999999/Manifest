import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// `secondary` (`bg-accent/60`) was removed rather than kept "just in case".
// Measured against `primary` (`bg-accent`) it is ΔE 2.8 — barely past the
// threshold where two colours are distinguishable at all, so it was not a
// second variant, it was a second name for the first one. Two names for one
// look is how a type badge ends up impersonating a status badge (TEAM.md #30).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-accent text-accent-foreground",
        outline: "border border-border bg-background text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        // Same tint-plus-role-colour recipe as `destructive` and as `Callout`,
        // so "needs attention" looks the same whether it is a badge or a box.
        warning: "bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {/* A leading space, and it is load-bearing.
          
          A badge sits directly beside the thing it qualifies, with no
          whitespace between them in the markup — `<Link>Ayşe</Link><Badge>1
          animal</Badge>`. Sighted readers get the gap from `ms-2`; the
          accessible name is built by concatenating text, so a screen reader
          announced "1 animalArchived", "SMSNot connected", "Appointment
          confirmation1 SMS". pm heard all three on one tour and they have
          one cause, so they get one fix (TEAM.md #4, #26).
          
          Invisible without `sr-only` or any other machinery: this is a
          flex container, and a whitespace-only run between flex items is
          not rendered at all. It is still a text node, so the name gets
          its separator. */}
      {" "}
      {children}
    </span>
  );
}
