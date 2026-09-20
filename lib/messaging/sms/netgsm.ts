// Netgsm REST v2 transport (https://www.netgsm.com.tr/dokuman/).
//
// Auth: HTTP Basic with usercode:password. `encoding: "TR"` keeps Turkish
// characters on the 7-bit budget. `msgheader` is the registered sender title.
// Response `{ code: "00" | "01" | "02", jobid }` means accepted (01/02 flag a
// date field we don't send, so they're still successes); anything else is a
// documented error code.

import { env } from "@/lib/env";
import { TransportError, type MessageTransport, type SendRequest, type SendResult } from "../types";

const ENDPOINT = "https://api.netgsm.com.tr/sms/rest/v2/send";
const ACCEPTED = new Set(["00", "01", "02"]);

const ERROR_CODES: Record<string, string> = {
  "20": "message_too_long_or_invalid",
  "30": "invalid_credentials_or_ip",
  "40": "sender_title_not_registered",
  "50": "iys_controlled_sending_not_allowed",
  "51": "iys_brand_missing",
  "70": "invalid_parameters",
  "80": "sending_limit_exceeded",
  "85": "duplicate_send_blocked",
};

export const netgsmTransport: MessageTransport = {
  channel: "SMS",
  name: "netgsm",

  isConfigured() {
    return (
      env.SMS_PROVIDER === "netgsm" &&
      Boolean(env.NETGSM_USERCODE && env.NETGSM_PASSWORD && env.NETGSM_MSGHEADER)
    );
  },

  async send({ to, body }: SendRequest): Promise<SendResult> {
    if (!this.isConfigured()) throw new TransportError("sms_not_configured");

    const auth = Buffer.from(`${env.NETGSM_USERCODE}:${env.NETGSM_PASSWORD}`).toString("base64");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msgheader: env.NETGSM_MSGHEADER,
        encoding: "TR",
        iysfilter: "",
        messages: [{ msg: body, no: to }],
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      code?: string;
      jobid?: string;
      description?: string;
    };
    if (!res.ok) throw new TransportError(`netgsm_http_${res.status}`, json.description);
    const code = String(json.code ?? "");
    if (!ACCEPTED.has(code)) {
      throw new TransportError(ERROR_CODES[code] ?? `netgsm_code_${code || "unknown"}`, json.description);
    }
    return { providerId: json.jobid ?? "" };
  },
};
