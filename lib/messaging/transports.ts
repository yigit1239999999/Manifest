// Channel → transport registry.

import { env } from "@/lib/env";
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/whatsapp/provider";
import { logTransport } from "./sms/log";
import { netgsmTransport } from "./sms/netgsm";
import { TransportError, type Channel, type MessageTransport } from "./types";

const whatsappTransport: MessageTransport = {
  channel: "WHATSAPP",
  name: "meta-cloud-api",
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

export function transportName(channel: Channel): string | null {
  const t = getTransport(channel);
  return t?.isConfigured() ? t.name : null;
}
