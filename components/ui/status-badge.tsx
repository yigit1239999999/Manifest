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
  // would be a wall of green and the rows that need someone would stop
  // standing out.
  CONFIRMED: "neutral",
  // The single most demanding row in the app: the owner is standing in the
  // waiting room. `positive` means "closed well", and an arrival has not
  // closed, it has just begun.
  ARRIVED: "attention",
  // Work is already happening here, so it asks nothing of anyone. Spending
  // the attention tone on a state nobody has to act on dilutes it.
  IN_PROGRESS: "neutral",
  COMPLETED: "positive",
  CANCELLED: "quiet",
  // Not `danger`. `danger` is reserved for "something on our side failed",
  // and a patient who did not turn up is not our failure — it is the loss
  // this whole release exists to chase. Red reads as "over, failed"; amber
  // reads as "this row is waiting for you", which is the true one.
  NO_SHOW: "attention",
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
  // Neutral, even though `message.SENT` below is positive. Same word, two
  // different events: a message's job was to go out and it went out, so it
  // is done; a reminder went out but *the animal has not come back*, so the
  // work is still open and only quiet for now. Painting both green turns
  // /reminders into a wall of green made of reminders that achieved
  // nothing — the loop failing would look exactly like the loop working.
  SENT: "neutral",
  ACKNOWLEDGED: "positive",
  DISMISSED: "quiet",
} satisfies Record<ReminderStatus, StatusTone>;

const message = {
  SENT: "positive",
  FAILED: "danger",
  // `SENT` is a record of delivery: a carrier accepted the message. `MANUAL`
  // is a record of intent: someone opened or copied the text, and we have no
  // evidence at all that it was ever sent. Positive means "closed well", and
  // MANUAL cannot claim to have closed. This is also why R1's done-threshold
  // counts `status = SENT` rather than any row in `message_logs` — staff
  // sending by hand would otherwise pass a bar the cron never cleared.
  MANUAL: "neutral",
} satisfies Record<MessageStatus, StatusTone>;

const prescription = {
  ACTIVE: "neutral",
  COMPLETED: "positive",
  CANCELLED: "quiet",
} satisfies Record<PrescriptionStatus, StatusTone>;

// Not an enum in the database: `User.active` is a boolean. It is mapped to
// two names here anyway, because "a coloured pill always means status" is
// only true if the boolean one goes through the same door as the rest.
const staff = {
  active: "neutral",
  // An account that cannot sign in is an exception the administrator has to
  // notice, not a failure. Amber, not red.
  inactive: "attention",
} satisfies Record<"active" | "inactive", StatusTone>;

// Not an enum either: `archivedAt` is a nullable timestamp, so there is only
// ever one named state to render. It goes through the same door as the rest
// for the reason `staff` does — an archived row now appears in the lists
// beside live ones, and a one-off grey pill invented at that call site would
// be a second badge system next to this one (TEAM.md #30).
//
// The tone is `quiet`, not `attention`: the backlog asked for "inactive",
// which was a tone name before the tones were retuned and is now a *staff
// status*. What it described — "no longer valid, but not an error" — is word
// for word what `quiet` means today, and archiving is a deliberate act by
// the clinic, not something anyone has to go and fix.
const archive = {
  archived: "quiet",
} satisfies Record<"archived", StatusTone>;

const tones = {
  appointment,
  invoice,
  reminder,
  message,
  prescription,
  staff,
  archive,
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
 *   - not used for *type* badges (visit type, message channel, audit action,
 *     section counters): those are labels, not states. They all used to be
 *     `Badge variant="secondary"`, which measures ΔE 2.8 against the
 *     positive tone's fill — the same pill to the eye. So on the
 *     appointments list "Vaccination" (a type) and "Arrived" (a state) were
 *     indistinguishable, and the state badge carried no information at all.
 *     `secondary` is gone and those call sites are plain `Badge`; the rule
 *     left standing is that a coloured pill always means status.
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
