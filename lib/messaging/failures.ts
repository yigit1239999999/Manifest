// Whose problem a failed send is.
//
// Read back from what `MessageLog.error` holds, which is the transport's
// stable code and not the provider's free text -- see `deliver()` in
// modules/notifications/service.ts for why the code is what gets stored.
// Free text cannot be classified without pattern-matching sentences a
// provider is free to reword, which is a wire trap: it works until the
// day the wording changes, and then it is silently wrong.

import { NETGSM_ERRORS } from "./sms/netgsm";
import type { FailureScope } from "./types";

const SCOPES: Record<string, FailureScope> = {
  ...Object.fromEntries(Object.values(NETGSM_ERRORS).map((e) => [e.key, e.scope])),
  // Not a provider answer at all: the channel was never wired up.
  sms_not_configured: "CLINIC",
};

/**
 * `null` means "we do not know", and it must stay tellable from both
 * answers. Two things land here: rows written before the code was
 * stored (they hold a provider sentence), and codes nobody has
 * classified yet -- an HTTP failure, a WhatsApp rejection, a Netgsm
 * code outside the documented table. Guessing `MESSAGE` for those
 * would put a wrong reason on a row; a screen with no scope says
 * "it could not be sent" and stops there.
 */
export function failureScope(error: string | null | undefined): FailureScope | null {
  if (!error) return null;
  return SCOPES[error] ?? null;
}
