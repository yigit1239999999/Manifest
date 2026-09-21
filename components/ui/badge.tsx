import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// `secondary` (`bg-accent/60`) was removed rather than kept "just in case".
// Measured against `primary` (`bg-accent`) it is ΔE 2.8 — barely past the
// threshold where two colours are distinguishable at all, so it was not a
// second variant, it was a second name for the first one. Two names for one
// look is how a type badge ends up impersonating a status badge (TEAM.md #30).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
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

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
