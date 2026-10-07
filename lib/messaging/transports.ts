// Channel → transport registry.

import { env } from "@/lib/env";
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/whatsapp/provider";
import { logTransport } from "./sms/log";
import { netgsmTransport } from "./sms/netgsm";
import { TransportError, type Channel, type MessageTransport } from "./types";

const whatsappTransport: MessageTransport = {
  channel: "WHATSAPP",
  name: "meta-cloud-api",
  // No report source yet: Meta delivers these by webhook, which needs a
  // public URL and provider-side setup, so it is a later package. Until
  // then a clinic on WhatsApp is told its messages were sent and is
  // promised nothing about their arrival -- rather than being shown a
  // wait that would never end.
  reportsDelivery: false,
  isConfigured: () => isWhatsAppConfigured(),
  async send({ to, body }) {
    try {
      const { id } = await sendWhatsAppText(to, body);
      return { providerId: id };
    } catch (error) {
      throw new TransportError(
        "whatsapp_send_failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};

function smsTransport(): MessageTransport | null {
  switch (env.SMS_PROVIDER) {
    case "netgsm":
      return netgsmTransport;
    case "log":
      return logTransport;
    default:
      return null;
  }
}

export function getTransport(channel: Channel): MessageTransport | null {
  return channel === "SMS" ? smsTransport() : whatsappTransport;
}

export function isChannelConfigured(channel: Channel): boolean {
  return getTransport(channel)?.isConfigured() ?? false;
}

/**
 * Whether this channel can ever say what became of a message.
 *
 * Asked of the transport rather than of the data: a message with no
 * report is `UNKNOWN` either way, and only the transport knows whether
 * that is "not yet" or "not ever".
 */
export function transportReportsDelivery(channel: Channel): boolean {
  return getTransport(channel)?.reportsDelivery ?? false;
}

export function transportName(channel: Channel): string | null {
  const t = getTransport(channel);
  return t?.isConfigured() ? t.name : null;
}
