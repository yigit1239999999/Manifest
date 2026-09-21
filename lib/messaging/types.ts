// Messaging core types. A transport delivers a composed text over one channel.

export type Channel = "SMS" | "WHATSAPP";
export type MessageLocale = "tr" | "en";

export interface SendRequest {
  /** Digits-only international number, e.g. "905321234567". */
  to: string;
  body: string;
  language: MessageLocale;
}

export interface SendResult {
  /** Provider-side id (job id, message id) for tracing; may be empty. */
  providerId: string;
}

/**
 * What became of a message after the provider accepted it.
 *
 * Mirrors `MessageDeliveryStatus` in the schema, and keeps the same
 * distinction: `unknown` is ours (nobody asked), `pending` is theirs
 * (asked, no answer yet). Collapsing them would make a screen unable
 * to tell a poller that is not running from a provider that is slow.
 */
export type DeliveryState = "pending" | "delivered" | "undelivered" | "expired";

export interface DeliveryReport {
  state: DeliveryState;
  /** The provider's own code, for tracing. Never shown to a user. */
  code: string | null;
  /** When the provider says it arrived; only meaningful for `delivered`. */
  at: Date | null;
}

export interface MessageTransport {
  readonly channel: Channel;
  readonly name: string;
  /**
   * Whether anything will ever tell us what became of a message here.
   *
   * A capability, not a status, and the difference is what a screen is
   * allowed to promise. On a channel with no report source every
   * message stays UNKNOWN for ever, and a row saying "waiting for the
   * delivery report" would be waiting for something that is never
   * coming -- implying a process we do not have, which is the same
   * defect as a silent row seen from the other side.
   *
   * Declared next to the transport rather than inferred from
   * `reports` being present, because the day WhatsApp's webhook lands
   * this flips in one place and every screen follows.
   */
  readonly reportsDelivery: boolean;
  isConfigured(): boolean;
  send(request: SendRequest): Promise<SendResult>;
  /**
   * Delivery reports for messages this transport sent, keyed by the
   * `providerId` it returned.
   *
   * Optional because not every channel can answer it, and a channel
   * that cannot must say so by absence rather than by returning
   * "pending" forever -- the second would look like a provider that
   * never makes up its mind, which is a different problem with a
   * different fix.
   *
   * An id the provider has no answer for is simply absent from the
   * result. Absent is not `undelivered`.
   */
  reports?(providerIds: string[]): Promise<Record<string, DeliveryReport>>;
}

/**
 * Who has to do something about a failure.
 *
 * `CLINIC`: nothing about this message or this owner caused it -- an
 * unapproved sender title, spent credit, a rejected password. Every
 * message the clinic sends fails the same way until somebody changes a
 * setting, so it is one fact about the clinic and not forty facts about
 * forty owners.
 *
 * `MESSAGE`: this message, on its own terms. A body the provider would
 * not take, a duplicate it refused.
 *
 * The distinction is what keeps a vet from opening forty rows and
 * phoning forty people over one wrong setting.
 */
export type FailureScope = "CLINIC" | "MESSAGE";

/** Thrown by transports; `code` is stable for logs, `message` is provider detail. */
export class TransportError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TransportError";
  }
}
