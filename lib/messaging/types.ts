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
