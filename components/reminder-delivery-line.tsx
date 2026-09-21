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
 * The mark says the class of outcome and the text says the reason — the
 * blocked states share `BellOff` on purpose, the way `Callout` keeps one
 * meaning to one icon.
 *
 * WEIGHT IS INVERTED ON PURPOSE, and it is the design, not a detail. This
 * list is not a collection of receipts, it is the list of owners who were
 * not reached: what failed and what is blocked comes forward in the warning
 * colour, and "it went" sits back in the quiet one. The vet who asked for
 * this put it better than we did — "it will say 'sent' next to the old
 * number and I will relax. Worse than today, because today I at least have
 * a doubt, and the word 'sent' takes the doubt away too." So the record is
 * kept, because otherwise it lives on one receptionist's personal phone and
 * dies with her handset, but it is kept without congratulating anyone.
 *
 * NAMING RULE, and it holds even after this component changes hands: `SENT`
 * means the provider accepted the message, and nothing more. The Turkish
 * word is "Gönderildi" and the English is "Sent" — never "Ulaştı",
 * "İletildi", "Delivered" or "Bildirildi". We have no delivery report; when
 * `deliveredAt` arrives, "Ulaştı" is born as a SECOND and separate word
 * beside this one. A word must not imply a guarantee we do not hold yet,
 * and the breach will not be in this file — it will be in somebody six
 * months from now changing a string because it "reads better".
 *
 * The clinic's own master switch is deliberately NOT a state here. When it
 * is off nothing on the list can be sent, which is one fact about the
 * clinic rather than one fact about each owner, so it is said once in a
 * banner above the list (`NotificationBlockedBanner`) and the rows stay
 * silent about it. Putting it back would print the same sentence a hundred
 * times and point a hundred rows at the same single setting.
 *
 * A list and not a bare union, so the states can be walked over at runtime:
 * an eighth one added here without a sentence beside it renders an empty
 * line, which is the one failure this component can have and the one a type
 * cannot catch. `reminder-delivery-line.test.tsx` walks this.
 */
export const REMINDER_DELIVERY_STATES = [
  /** Due to go out; the sweep has worked out when. */
  "scheduled",
  /** The provider accepted it. Accepted, not delivered — see the naming rule. */
  "sent",
  /** Rejected, and the sweep will try again. */
  "failedRetrying",
  /** Rejected, and no automatic attempt is left. Only a person can move it. */
  "failedExhausted",
  /**
   * Rejected for something about the clinic, not about this owner. The row
   * says only that it did not go; the reason is in the banner, once.
   */
  "failedClinic",
  /** The client was asked and said no. */
  "optedOut",
  /** Nobody ever asked the client. A different job from `optedOut`. */
  "neverAsked",
  /** No phone number on the client record. */
  "noPhone",
  /** The channel is chosen but its provider credentials are missing. */
  "notConfigured",
  /** The reminder names an animal that has died or been archived. */
  "petSilenced",
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
  | { state: "failedRetrying"; at: Date; attempts: number }
  | { state: "failedExhausted"; at: Date; attempts: number }
  | { state: "failedClinic"; at: Date }
  | { state: "optedOut" }
  | { state: "neverAsked" }
  | { state: "noPhone" }
  | { state: "notConfigured"; channel: string }
  | { state: "petSilenced" };

/**
 * Three weights, and the middle one is the point of the screen.
 *
 * `alert` is a message the provider rejected. `attention` is everything
 * that will not go out and can be acted on. `quiet` is the record: due to
 * go, or already gone.
 *
 * Measured against `bg-card`, which is what the row actually sits on, in
 * both themes: `--muted-fg` 5.78 light / 6.90 dark, `--warning` 7.07 /
 * 9.22, `--destructive` 7.10 / 6.24. All three clear AA at this size with
 * room to spare, so the tier carries meaning rather than legibility.
 */
const TONE = {
  alert: "text-destructive font-medium",
  attention: "text-warning font-medium",
  quiet: "text-muted-foreground",
} as const;

const WEIGHT: Record<ReminderDeliveryStateName, keyof typeof TONE> = {
  scheduled: "quiet",
  sent: "quiet",
  failedRetrying: "alert",
  failedExhausted: "alert",
  failedClinic: "alert",
  optedOut: "attention",
  neverAsked: "attention",
  noPhone: "attention",
  notConfigured: "attention",
  // An open reminder for an animal that is gone is not an emergency, but it
  // is stale work that will never finish on its own, and the only way it
  // leaves the list is somebody closing it.
  petSilenced: "attention",
};

const MARK: Record<ReminderDeliveryStateName, typeof Clock> = {
  scheduled: Clock,
  sent: Check,
  failedRetrying: AlertCircle,
  failedExhausted: AlertCircle,
  failedClinic: AlertCircle,
  optedOut: BellOff,
  neverAsked: BellOff,
  noPhone: BellOff,
  notConfigured: BellOff,
  petSilenced: BellOff,
} as const;

export async function ReminderDeliveryLine(props: ReminderDeliveryLineProps) {
  const [t, fmt] = await Promise.all([
    getTranslations("reminder.delivery"),
    getFormatContext(),
  ]);
  const Mark = MARK[props.state];

  // Inline colour and not a `Callout`, at every weight: a list can hold a
  // hundred of these, and a hundred boxes is an alarm rather than a list.
  return (
    <p
      className={cn(
        "mt-1 flex items-start gap-1.5 text-xs",
        TONE[WEIGHT[props.state]],
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
      // The provider's own words never reach the row. `MessageLog.error`
      // holds raw transport text -- Netgsm answers things like "30 -
      // Hatalı kullanıcı adı" -- and a vet reading a row should not have
      // to decode an operator's error catalogue to find out what to do.
      // The raw text is kept and shown folded away; the row carries a
      // sentence that says what happened and what is left to try.
      case "failedRetrying":
        return t("failedRetrying", {
          at: formatDateTime(fmt, props.at),
          attempts: props.attempts,
        });
      case "failedExhausted":
        // Not "abandoned" or "given up on", which the vet who reviewed
        // this rejected by asking the right question: "who gave up, me or
        // the system?" Long and plain beats short and riddling.
        return t("failedExhausted", {
          at: formatDateTime(fmt, props.at),
          attempts: props.attempts,
        });
      case "failedClinic":
        return t("failedClinic", { at: formatDateTime(fmt, props.at) });
      case "optedOut":
      case "neverAsked":
      case "noPhone":
      case "petSilenced":
        return t(props.state);
      case "notConfigured":
        return t("notConfigured", { channel: props.channel });
    }
  }
}
