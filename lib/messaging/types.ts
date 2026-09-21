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

export interface MessageTransport {
  readonly channel: Channel;
  readonly name: string;
  isConfigured(): boolean;
  send(request: SendRequest): Promise<SendResult>;
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
