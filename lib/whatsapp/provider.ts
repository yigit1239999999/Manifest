// WhatsApp Cloud API (Meta) transport.
//
// Configured through WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID. When
// either is missing the app degrades to "open in WhatsApp" links so staff
// can still send the composed message by hand.
//
// Note: Meta only lets a business open a conversation with a pre-approved
// template; free-form text is accepted inside a 24-hour customer-service
// window. Register the confirmation/reminder copy as templates in the Meta
// Business Manager for fully automatic delivery.

import { env } from "@/lib/env";

const GRAPH_VERSION = "v20.0";

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<{ id: string }> {
  if (!isWhatsAppConfigured()) throw new Error("whatsapp_not_configured");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `whatsapp_http_${res.status}`);
  }
  return { id: json.messages?.[0]?.id ?? "" };
}
