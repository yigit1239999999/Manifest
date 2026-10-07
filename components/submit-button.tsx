"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The button that submits a form, and does not disappear out from under
 * the person who pressed it.
 *
 * It used to set `disabled` while the action was in flight. A control
 * disabled under the user's finger loses focus to `body`, and focus does
 * not come back when it is re-enabled — ux measured the disabling at
 * under 150ms and the focus loss as permanent, with 22 Tab presses from
 * `body` to the first field that needed fixing.
 *
 * `aria-busy` says the same thing without taking the control away.
 * Double submission is still prevented, but by refusing the second
 * press rather than by removing the button: `disabled` was doing two
 * jobs and only one of them was wanted.
 */
export function SubmitButton({ children, onClick, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      {...props}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (pending) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      // A caller's own `disabled` still stands — that is a real "you
      // cannot do this yet", not a transient one.
      disabled={props.disabled}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
