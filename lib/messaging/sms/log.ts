// Development transport: prints the SMS instead of sending it. Enabled with
// SMS_PROVIDER=log so the whole flow (settings, cron, message log) can be
// exercised locally at zero cost.

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  DeliveryReport,
  MessageTransport,
  SendRequest,
  SendResult,
} from "../types";

/**
 * How a fabricated report is decided, and why it is fabricated at all.
 *
 * A transport that answered "delivered" to everything would leave the
 * screen with one state it could ever show, and the three the vet
 * actually needs to act on would go the whole of development unseen.
 * That is precisely what happened to the failed-send sentence this
 * week: written, tested, and never once rendered, because nothing in
 * the product could produce the data behind it.
 *
 * So this is not test data. It is this provider's behaviour: the log
 * transport is a pretend operator from end to end, and a real operator
 * delivers most messages, fails some, and keeps quiet about others for
 * a while. Making it answer honestly-shaped nonsense is what makes the
 * delivery screens measurable before any account exists.
 *
 * Deterministic in the provider id, not random. Re-asking about the
 * same message must give the same answer, or a poller run twice would
 * report a message as delivered and then as pending, and a screen
 * would flicker between two truths. The hash is trivial on purpose --
 * what matters is that it is stable and spread, not that it is good.
 */
function pretendReport(providerId: string): DeliveryReport {
  let hash = 0;
  for (const ch of providerId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bucket = hash % 10;
  // Roughly: seven delivered, two undelivered, one still pending. A
  // pending one has to exist or "we have not heard yet" -- the state a
  // screen must not read as failure -- never appears either.
  // The codes are the provider's real ones: `1` is delivered, `3` is a
  // wrong or restricted number, `0` is still in the retry window. A
  // pretend operator that answered with invented codes would let a
  // mapping mistake pass unnoticed here and only surface in
  // production -- which is how `0` and `1` came to be the wrong way
  // round in the first place.
  if (bucket < 7) return { state: "delivered", code: "1", at: new Date() };
  if (bucket < 9) return { state: "undelivered", code: "3", at: null };
  return { state: "pending", code: "0", at: null };
}

export const logTransport: MessageTransport = {
  channel: "SMS",
  name: "log",
  // A pretend operator that answers pretend reports, so the delivery
  // screens are measurable before any account exists.
  reportsDelivery: true,
  isConfigured() {
    return env.SMS_PROVIDER === "log";
  },
  async send({ to, body, language }: SendRequest): Promise<SendResult> {
    logger.info("sms.log_transport", { to, language, body });
    return { providerId: `log-${Date.now()}` };
  },
  async reports(providerIds: string[]): Promise<Record<string, DeliveryReport>> {
    const out: Record<string, DeliveryReport> = {};
    for (const id of providerIds) {
      // Ids this transport did not issue get no answer, the same way a
      // real provider answers nothing about a job it never had.
      if (!id.startsWith("log-")) continue;
      out[id] = pretendReport(id);
    }
    logger.info("sms.log_transport_reports", { asked: providerIds.length, answered: Object.keys(out).length });
    return out;
  },
};
