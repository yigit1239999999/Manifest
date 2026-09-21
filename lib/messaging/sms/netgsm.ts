// Netgsm REST v2 transport (https://www.netgsm.com.tr/dokuman/).
//
// Auth: HTTP Basic with usercode:password. `encoding: "TR"` keeps Turkish
// characters on the 7-bit budget. `msgheader` is the registered sender title.
// Response `{ code: "00" | "01" | "02", jobid }` means accepted (01/02 flag a
// date field we don't send, so they're still successes); anything else is a
// documented error code.

import { env } from "@/lib/env";
import {
  TransportError,
  type FailureScope,
  type MessageTransport,
  type SendRequest,
  type SendResult,
} from "../types";

const ENDPOINT = "https://api.netgsm.com.tr/sms/rest/v2/send";
const ACCEPTED = new Set(["00", "01", "02"]);

/**
 * Netgsm's documented failures, each with whose problem it is.
 *
 * The scope is next to the code rather than in a list beside it, so a
 * code cannot be added without deciding it -- and almost all of them
 * turn out to be the clinic's. That is the substance: a bad phone
 * number produces none of these (it fails at delivery, not at
 * acceptance), so "this message failed" is the rare case here and
 * "every message is failing" is the ordinary one.
 *
 * `70` is CLINIC on the same test. The parameters are ours, not the
 * owner's: if we are building a request the gateway will not take, it
 * takes none of them, and forty identical row-level sentences would
 * send a vet to forty owners over one bug.
 */
export const NETGSM_ERRORS: Record<string, { key: string; scope: FailureScope }> = {
  "20": { key: "message_too_long_or_invalid", scope: "MESSAGE" },
  "30": { key: "invalid_credentials_or_ip", scope: "CLINIC" },
  "40": { key: "sender_title_not_registered", scope: "CLINIC" },
  "50": { key: "iys_controlled_sending_not_allowed", scope: "CLINIC" },
  "51": { key: "iys_brand_missing", scope: "CLINIC" },
  "70": { key: "invalid_parameters", scope: "CLINIC" },
  "80": { key: "sending_limit_exceeded", scope: "CLINIC" },
  "85": { key: "duplicate_send_blocked", scope: "MESSAGE" },
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
      throw new TransportError(
        NETGSM_ERRORS[code]?.key ?? `netgsm_code_${code || "unknown"}`,
        json.description,
      );
    }
    return { providerId: json.jobid ?? "" };
  },
};
