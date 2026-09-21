import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The focus mark is an outline, not a ring, and ux measured why.
//
// A `ring` draws its gap with `ring-offset-background` — the page colour —
// which is a second place encoding an assumption about what the button is
// sitting on. On a card that assumption is wrong, and cards are where most
// buttons in this app live: form submits, the collapsible clinical blocks,
// the dashboard. A focused button on a card had a two-pixel band of page
// colour around it.
//
// `outline-offset` leaves the gap transparent, so the real surface shows
// through and no second colour is defined anywhere. Same width, same
// `--ring`, same gap as the link rule in `globals.css` — and now the same
// behaviour on every surface.
//
// `outline-none` is gone with it: it was there to clear the browser's own
// outline before drawing a ring in its place, and there is nothing to
// clear now.
//
// The colour is written out rather than reached through the `outline-ring`
// utility. `outline-color`'s initial value is `currentColor`, so if that
// utility ever fails to reach an element the mark does not disappear —
// it turns the colour of the text, which on a primary button is nearly
// the colour of the button. An invisible focus ring is worse than none,
// because it looks handled. The arbitrary value cannot fall back.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary:
          "border border-border bg-card text-foreground shadow-sm hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "border border-destructive/30 bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
