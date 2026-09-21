import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// One boxed message, three severities. `danger` and `warning` derive border
// and fill from a single role colour at low alpha and paint the text in the
// role colour itself — the pattern the error boxes already used, now in one
// place instead of eleven.
//
// `info` is not a role colour at all, on purpose. It reports an absence, not
// a fault: "the channel you picked is not connected yet". Painting that in a
// severity colour would put it in the same visual class as a failure, and a
// palette where everything is loud says nothing. It uses the neutral surface
// two screens had already settled on by hand
// (`appointments/[id]`, `settings`), which is also why it needs no new token:
// `--muted-fg` on `bg-muted/40` measures 5.35 on card, 5.04 on the page and
// 4.73 on muted in light, and 6.60 / 6.97 / 6.22 in dark.
//
// Deliberately absent, each for a reason:
//   - no `success`: still no call site. `info` had none either when this
//     comment was first written; it has three now, so it exists. The rule is
//     "no abstraction without a call site" (TEAM.md #30), not "never add
//     one" — but the comment has to be corrected when the fact changes, or
//     the next person reads a deliberate absence into an oversight.
//   - no dismiss: a "bites / allergic" warning that a user can close stays
//     closed for the next animal. Not a prop, so it cannot be argued back in.
//   - no size: both groups of call sites use the same density today.
//   - no icon override: the same meaning should carry the same mark everywhere.
const calloutVariants = cva(
  "flex items-start gap-2 rounded-control border px-3 py-2 text-sm",
  {
    variants: {
      variant: {
        danger: "border-destructive/30 bg-destructive/10 text-destructive",
        warning: "border-warning/30 bg-warning/10 text-warning",
        info: "border-border bg-muted/40 text-muted-foreground",
      },
    },
  },
);

const variantIcon = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
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
   * and `info` (standing notices that are already there when the page
   * loads). Callers with the opposite situation pass it explicitly — the
   * notification settings box appears only after the main switch is turned
   * on, so it announces.
   *
   * `false` still leaves a `status` role behind, so the notice has a name
   * in the accessibility tree even when it is not announcing. `"none"` is
   * the third case and there is one of it: `ActionForm` moves focus to its
   * error box, and a focused live region is read twice. Whoever announces
   * it, only one thing may.
   */
  live?: boolean | "none";
}

export function Callout({
  variant,
  title,
  live,
  className,
  children,
  ref,
  ...props
}: CalloutProps & { ref?: React.Ref<HTMLDivElement> }) {
  const Icon = variantIcon[variant];
  const announce = (live ?? variant === "danger") === true;

  return (
    <div
      ref={ref}
      // Always a role, and which one is the only question.
      //
      // It used to be `alert` or nothing, and "nothing" meant a box that
      // reads as a warning to anyone looking at it and as an unnamed
      // `div` to anyone not. pm found it on the reminder banner -- the
      // notice telling a clinic that no message is going out at all was
      // undiscoverable without reading the page end to end -- and every
      // standing notice here had the same hole: an archived client, a
      // deceased animal, "bites".
      //
      // `status` and not `alert` for those, because they are conditions
      // rather than events; `alert` is assertive and would interrupt.
      // Neither announces on first paint -- a live region only speaks for
      // content arriving after it mounts -- so this buys discoverability,
      // not noise. What it does change: a non-`live` callout that appears
      // after mount now gets a polite announcement, which is the right
      // answer for every case above.
      //
      // `role="alert"` carries an implicit assertive live region; adding
      // aria-live alongside it is redundant and double-announces in some
      // screen reader / browser pairings.
      role={live === "none" ? undefined : announce ? "alert" : "status"}
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
