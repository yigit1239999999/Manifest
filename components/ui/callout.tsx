import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// One boxed message, two severities. Both derive border and fill from a single
// role colour at low alpha and paint the text in the role colour itself — the
// pattern the error boxes already used, now in one place instead of eleven.
//
// Deliberately absent, each for a reason:
//   - no `info` / `success`: there is no call site for either today.
//   - no dismiss: a "bites / allergic" warning that a user can close stays
//     closed for the next animal. Not a prop, so it cannot be argued back in.
//   - no size: both groups of call sites use the same density today.
//   - no icon override: the same meaning should carry the same mark everywhere.
const calloutVariants = cva(
  "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
  {
    variants: {
      variant: {
        danger: "border-destructive/30 bg-destructive/10 text-destructive",
        warning: "border-warning/30 bg-warning/10 text-warning",
      },
    },
  },
);

const variantIcon = {
  danger: AlertCircle,
  warning: AlertTriangle,
} as const;

/**
 * Required, and non-nullable on purpose: severity is the whole point of the
 * component, so there is no sensible default to fall back to silently.
 * (cva's own `VariantProps` admits `null`, which would allow an unstyled box.)
 */
export type CalloutVariant = NonNullable<
  VariantProps<typeof calloutVariants>["variant"]
>;

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "role" | "title"> {
  variant: CalloutVariant;
  /** Optional heading above the message. */
  title?: string;
  /**
   * Announce this callout to assistive technology when it appears.
   *
   * A live region only announces content that arrives AFTER it mounts, so this
   * is worth turning on exactly when the callout is conditionally rendered —
   * a form error appearing after a submit. It is worth leaving off when the
   * callout is part of the first paint: there is nothing to announce, and a
   * region that speaks on load is noise competing with the page itself.
   *
   * Defaults to on for `danger` (server-action errors) and off for `warning`
   * (standing notices that are already there when the page loads). Callers
   * with the opposite situation pass it explicitly.
   */
  live?: boolean;
}

export function Callout({
  variant,
  title,
  live,
  className,
  children,
  ...props
}: CalloutProps) {
  const Icon = variantIcon[variant];
  const announce = live ?? variant === "danger";

  return (
    <div
      // `role="alert"` carries an implicit assertive live region; adding
      // aria-live alongside it is redundant and double-announces in some
      // screen reader / browser pairings.
      role={announce ? "alert" : undefined}
      className={cn(calloutVariants({ variant }), className)}
      {...props}
    >
      {/* Decorative: the severity is already carried by the text. Naming it
          would make screen readers read "warning" before every message. */}
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {/* min-w-0 above lets long unbroken owner-typed text wrap instead of
            pushing the box wider than its column. */}
        <div className="min-w-0 break-words">{children}</div>
      </div>
    </div>
  );
}
