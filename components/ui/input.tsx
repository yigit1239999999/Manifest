import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // Why this is not the button's focus mark, written down because
        // it reads as an inconsistency and the next person will merge
        // them — ux nearly did.
        //
        // A field already has a border, so on focus the border itself
        // turns `--ring` and becomes the mark; the halo behind it is
        // secondary and deliberately faint (`/30`). A button has no
        // border, so its outline has to carry the whole signal on its
        // own. Two different marks because they are two different
        // shapes, not because nobody looked.
        "h-10 w-full rounded-control border border-input bg-card px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
