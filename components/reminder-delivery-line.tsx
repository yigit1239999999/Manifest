import Link from "next/link";
import { AlertCircle, BellOff, Check, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the app is going to do, or has already done, about one reminder.
 *
 * The row already carried a status badge, and the badge answers a different
 * question: `PENDING` is the state of the *work*, not of the message. It
 * reads the same for a reminder that goes out tomorrow morning and for one
 * that will never go out at all because the clinic's notification switch is
 * off — and that second case was every clinic, since the switch defaults to
 * off (`modules/notifications/settings.ts`). So the loop was running, or
 * silently not running, and no screen said which. This sentence is that
 * missing half; the badge is left alone.
 *
 * Seven states and not one hedged sentence, because "will not be sent" has
 * four different causes and each is fixed in a different place: the client
 * record, the clinic settings, the provider credentials, or nothing at all.
 * A single "not sent" would send the vet looking in the wrong one.
 *
 * The mark says the class of outcome and the text says the reason — the four
 * blocked states share `BellOff` on purpose, the way `Callout` keeps one
 * meaning to one icon.
 *
 * A list and not a bare union, so the states can be walked over at runtime:
 * an eighth one added here without a sentence beside it renders an empty
 * line, which is the one failure this component can have and the one a type
 * cannot catch. `reminder-delivery-line.test.tsx` walks this.
 */
export const REMINDER_DELIVERY_STATES = [
  /** Due to go out; the sweep has worked out when. */
  "scheduled",
  /** A `MessageLog` row exists and the provider accepted it. */
  "sent",
  /** The provider rejected it. */
  "failed",
  /** The client has not consented to notification messages. */
  "optedOut",
  /** No phone number on the client record. */
  "noPhone",
  /** The channel is chosen but its provider credentials are missing. */
  "notConfigured",
  /** The clinic's notification switch is off: nothing goes out at all. */
  "disabled",
] as const;

export type ReminderDeliveryStateName =
  (typeof REMINDER_DELIVERY_STATES)[number];

/**
 * A discriminated union and not seven optional fields: a `sent` state
 * without a timestamp, or a `notConfigured` without a channel, would render
 * a sentence with a hole in it, and only the shape of the props can stop
 * that at the call site.
 *
 * The channel arrives as an already-translated label rather than as a
 * `Channel`, for the reason TEAM.md #20e names: it is a leaf value either
 * way, so nothing about the enum has to travel.
 */
export type ReminderDeliveryLineProps =
  | { state: "scheduled"; sendAt: Date; channel: string }
  | { state: "sent"; at: Date; channel: string }
  | {
      state: "failed";
      at: Date;
      channel: string;
      /** What the provider said. Null when it failed without saying. */
      error: string | null;
      attempts: number;
    }
  | { state: "optedOut" }
  | { state: "noPhone" }
  | { state: "notConfigured"; channel: string }
  | {
      state: "disabled";
      /**
       * Where to turn notifications on. Omitted for a role without
       * `settings.manage`, which gets told who to ask instead. The sentence
       * itself never disappears: hiding the reason from someone who cannot
       * fix it leaves them with a reminder that quietly does nothing.
       */
      settingsHref?: string;
    };

const MARK: Record<ReminderDeliveryStateName, typeof Clock> = {
  scheduled: Clock,
  sent: Check,
  failed: AlertCircle,
  optedOut: BellOff,
  noPhone: BellOff,
  notConfigured: BellOff,
  disabled: BellOff,
} as const;

export async function ReminderDeliveryLine(props: ReminderDeliveryLineProps) {
  const [t, fmt] = await Promise.all([
    getTranslations("reminder.delivery"),
    getFormatContext(),
  ]);
  const Mark = MARK[props.state];

  // A failure is the one state that asks for something, so it is the one
  // state that is coloured. Inline `text-destructive` and not a `Callout`:
  // a list can hold twenty of these, and twenty boxes is an alarm, not a
  // list.
  const failed = props.state === "failed";

  return (
    <p
      className={cn(
        "mt-1 flex items-start gap-1.5 text-xs",
        failed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Mark aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0">{sentence()}</span>
    </p>
  );

  function sentence() {
    switch (props.state) {
      case "scheduled":
        return t("scheduled", {
          at: formatDateTime(fmt, props.sendAt),
          channel: props.channel,
        });
      case "sent":
        return t("sent", {
          at: formatDateTime(fmt, props.at),
          channel: props.channel,
        });
      case "failed":
        return props.error
          ? t("failed", {
              at: formatDateTime(fmt, props.at),
              error: props.error,
              attempts: props.attempts,
            })
          : // No reason from the provider means no reason on screen. A
            // stand-in sentence here would read as an explanation and be
            // one more thing to disbelieve (TEAM.md #21).
            t("failedNoReason", {
              at: formatDateTime(fmt, props.at),
              attempts: props.attempts,
            });
      case "optedOut":
      case "noPhone":
        return t(props.state);
      case "notConfigured":
        return t("notConfigured", { channel: props.channel });
      case "disabled":
        return (
          <>
            {t("disabled")}{" "}
            {props.settingsHref ? (
              <Link
                href={props.settingsHref}
                className="underline hover:no-underline"
              >
                {t("openSettings")}
              </Link>
            ) : (
              t("askAdmin")
            )}
          </>
        );
    }
  }
}
