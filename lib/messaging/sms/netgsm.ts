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
  type DeliveryReport,
  type DeliveryState,
  type FailureScope,
  type MessageTransport,
  type SendRequest,
  type SendResult,
} from "../types";

const ENDPOINT = "https://api.netgsm.com.tr/sms/rest/v2/send";
const REPORT_ENDPOINT = "https://api.netgsm.com.tr/sms/rest/v2/report";
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

/**
 * Netgsm's delivery-report statuses, mapped only where the provider's
 * own documentation says what they mean.
 *
 * Read the table from the docs before touching this, and note that `0`
 * is NOT delivered: it is "İletilmeyi bekleyenler", still inside the
 * retry window. This file had `0` and `1` the wrong way round for an
 * hour, which made every queued message read "delivered" and every
 * delivered one read "waiting" -- and the first of those is the
 * dangerous direction, because nobody goes back to check a row that
 * says a message arrived.
 *
 *   0  İletilmeyi bekleyenler          → pending
 *   1  İletilmiş olanlar               → delivered
 *   2  Zaman aşımına uğramış olanlar   → expired
 *   3  Hatalı veya kısıtlı numara      → undelivered  (the actionable one)
 *
 * `version=1` is still not optional: without it the provider folds
 * `11`, `12` and `13` into the timeout answer, and `13` in particular
 * is not a delivery failure at all (see below). The parameter looks
 * like a detail and carries the distinction.
 */
const REPORT_STATES: Record<string, DeliveryState> = {
  // Still in the retry system. Temporary by definition: the send has a
  // `stopdate`, defaulting to 21 hours after the start, and until that
  // passes the operator is still trying.
  "0": "pending",
  "1": "delivered",
  // The retry window closed. Permanent, and deliberately not
  // `undelivered`: what we know is that the provider stopped, not that
  // the handset refused.
  "2": "expired",
  // A wrong or restricted number -- the one report that has an action
  // attached, and the reason the four buckets exist.
  "3": "undelivered",
};

/**
 * Report codes the documentation does not classify, listed rather than
 * silently missing, because an unmapped code is reported as ABSENT and
 * absence is read as "we have not heard".
 *
 *   4   Operatöre gönderilemedi     — unclassified
 *   11  Operatör kabul etmemiş      — unclassified
 *   12  Gönderim hatası             — unclassified
 *   13  Mükerrer                    — not a delivery failure at all:
 *       the provider blocks the same text to the same number inside an
 *       hour. That is OUR repeat, not the owner's phone, and sending a
 *       vet to call them would be entirely wrong.
 *   14  Yetersiz kredi · 15 kara liste · 16/17 İYS · 22 yurt dışı
 *       — account and regulatory matters, none of them the owner's.
 *
 * Netgsm's own `version=0` default folds 11/12/13 into the timeout
 * bucket, which hints at the permanent side for the first two -- a
 * hint, not a classification, and not enough to put a sentence on a
 * screen. Pending an answer from Netgsm support, they are left absent,
 * so the poller keeps asking and the row keeps saying "we have not
 * heard" rather than accusing a phone number.
 *
 * `100` is not a delivery status at all: it is an API error code
 * (100-110, "Sistem hatası"). It was mapped to `expired` here, wrongly.
 */

/**
 * Netgsm keeps reports for three months; older ids answer nothing, and
 * "nothing" is reported as absence rather than as failure.
 */
export const REPORT_RETENTION_DAYS = 90;

export const netgsmTransport: MessageTransport = {
  channel: "SMS",
  name: "netgsm",
  // Netgsm answers report queries for three months; see `reports` below.
  reportsDelivery: true,

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

  async reports(providerIds: string[]): Promise<Record<string, DeliveryReport>> {
    if (!this.isConfigured() || providerIds.length === 0) return {};

    const auth = Buffer.from(`${env.NETGSM_USERCODE}:${env.NETGSM_PASSWORD}`).toString("base64");
    const out: Record<string, DeliveryReport> = {};
    // One call per job id: a `bulkid` identifies one send, and the
    // report endpoint answers about one at a time. The caller decides
    // how many to ask for in a run, which is where the budget belongs.
    for (const bulkid of providerIds) {
      const res = await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        // `version: 1` is load-bearing. See REPORT_STATES above: without
        // it 11/12/13 arrive as one code and the four buckets the screen
        // draws become three.
        body: JSON.stringify({ bulkid, version: 1 }),
      });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => ({}))) as {
        messages?: { status?: string | number; donedate?: string }[];
      };
      const first = json.messages?.[0];
      if (!first) continue;
      const code = String(first.status ?? "");
      const state = REPORT_STATES[code];
      // An unmapped code is left absent rather than guessed at. A wrong
      // bucket here becomes a wrong sentence on a screen, and "we have
      // not heard" is the truthful fallback.
      if (!state) continue;
      out[bulkid] = {
        state,
        code,
        at: state === "delivered" && first.donedate ? new Date(first.donedate) : null,
      };
    }
    return out;
  },
};
