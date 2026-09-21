import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type {
  AppointmentStatus,
  InvoiceStatus,
  MessageStatus,
  PrescriptionStatus,
  ReminderStatus,
} from "@/generated/prisma/enums";

// One badge for every domain status, so that "PAID" and "DRAFT" stop looking
// identical. Before this, nine screens rendered every status as
// `<Badge variant="secondary">`, and the only status that had a colour was
// a hand-written `destructive` for a failed message.
//
// The rule the tones encode: **colour is earned, not default.** A status the
// clinic has no reason to act on stays neutral; colour is spent only on
// "this closed well", "this needs a person", and "this did not happen".
// If most rows are coloured, colour has stopped carrying information.
export type StatusTone =
  /** The expected, in-flight state. Nothing to do. */
  | "neutral"
  /** The loop closed the way it should have. */
  | "positive"
  /** A person has to do something about this. */
  | "attention"
  /** What should have happened did not. */
  | "danger"
  /** No longer in play: cancelled, voided, dismissed. Not a failure. */
  | "quiet";

// Tone -> appearance is the single place colour is decided. `Badge` stays the
// visual primitive; this component only assigns meaning to it, so there is no
// second badge system to drift (TEAM.md #30).
const toneVariant: Record<StatusTone, NonNullable<BadgeProps["variant"]>> = {
  neutral: "default",
  positive: "primary",
  attention: "warning",
  danger: "destructive",
  quiet: "outline",
};

// `satisfies Record<Enum, StatusTone>` is the whole point of these maps: add a
// value to a Prisma status enum and the build fails here instead of the new
// value quietly rendering as an unstyled badge in production (TEAM.md #6).
const appointment = {
  SCHEDULED: "neutral",
  // Deliberately neutral, not positive: a confirmed appointment is the normal
  // state of the list, not an achievement. If it were green, an ordinary day
  // would be a wall of green and ARRIVED would stop standing out.
  CONFIRMED: "neutral",
  ARRIVED: "positive",
  IN_PROGRESS: "neutral",
  COMPLETED: "positive",
  CANCELLED: "quiet",
  NO_SHOW: "danger",
} satisfies Record<AppointmentStatus, StatusTone>;

const invoice = {
  DRAFT: "neutral",
  SENT: "neutral",
  // The one status in the app that means money is sitting half-collected.
  // It is the state that gets forgotten, so it is the state that gets colour.
  PARTIAL: "attention",
  PAID: "positive",
  VOID: "quiet",
} satisfies Record<InvoiceStatus, StatusTone>;

const reminder = {
  PENDING: "neutral",
  SENT: "positive",
  ACKNOWLEDGED: "positive",
  DISMISSED: "quiet",
} satisfies Record<ReminderStatus, StatusTone>;

const message = {
  SENT: "positive",
  FAILED: "danger",
  MANUAL: "neutral",
} satisfies Record<MessageStatus, StatusTone>;

const prescription = {
  ACTIVE: "neutral",
  COMPLETED: "positive",
  CANCELLED: "quiet",
} satisfies Record<PrescriptionStatus, StatusTone>;

const tones = {
  appointment,
  invoice,
  reminder,
  message,
  prescription,
} as const;

export type StatusKind = keyof typeof tones;

type StatusOf<K extends StatusKind> = keyof (typeof tones)[K];

export function statusTone<K extends StatusKind>(
  kind: K,
  status: StatusOf<K>,
): StatusTone {
  return tones[kind][status] as StatusTone;
}

export type StatusBadgeProps<K extends StatusKind> = {
  kind: K;
  status: StatusOf<K>;
  /**
   * The translated status name.
   *
   * Passed in rather than looked up here on purpose: the component would
   * otherwise own strings from `messages/*.json`, and every caller is already
   * holding the right `getTranslations("enum.…Status")` namespace. It also
   * keeps the badge usable from both server and client components.
   */
  label: string;
  className?: string;
};

/**
 * Deliberately absent, each for a reason:
 *   - no icon: unlike `Callout`, a status badge is always accompanied by its
 *     own name, and the screens that use it render up to three badges per
 *     row. An icon per badge is noise, and the label already carries the
 *     meaning for anyone who cannot see the tone.
 *   - no `tone` override: a call site that can choose its own colour is how
 *     "PAID" ends up grey on one screen and green on another (TEAM.md #18).
 *   - not used for *type* badges (visit type, message channel, audit action):
 *     those are labels, not states. Giving them colour spends the same signal
 *     on something that never needs attention.
 */
export function StatusBadge<K extends StatusKind>({
  kind,
  status,
  label,
  className,
}: StatusBadgeProps<K>) {
  return (
    <Badge variant={toneVariant[statusTone(kind, status)]} className={className}>
      {label}
    </Badge>
  );
}
