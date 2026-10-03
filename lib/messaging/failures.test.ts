import { describe, expect, it } from "vitest";

import { failureScope } from "./failures";
import { NETGSM_ERRORS } from "./sms/netgsm";

describe("failureScope", () => {
  it("calls an unapproved sender title the clinic's problem", () => {
    // One setting, and every message the clinic sends fails until it
    // changes. Repeating that on forty rows sends a vet to forty owners.
    expect(failureScope("sender_title_not_registered")).toBe("CLINIC");
    expect(failureScope("sending_limit_exceeded")).toBe("CLINIC");
  });

  it("keeps the failure that really is about one message", () => {
    expect(failureScope("message_too_long_or_invalid")).toBe("MESSAGE");
  });

  // Ours, and the only scope with no sentence on any screen. The
  // provider refuses a repeat of the same text to the same number
  // within an hour, so it fires when WE sent twice -- nothing is wrong
  // with the number, the clinic or the operator, and the refusal is
  // evidence the first message was accepted. Telling a vet anything
  // about it would send them to an owner who already has the message.
  it("calls a repeat of our own what it is, and not the owner's fault", () => {
    expect(failureScope("duplicate_send_blocked")).toBe("PRODUCT");
  });

  it("answers null rather than guessing", () => {
    // A row written before the code was stored holds a provider
    // sentence; an unclassified code could be either. Both have to stay
    // tellable from a real answer, or a screen prints a wrong reason.
    expect(failureScope("Gonderici adi onayli degil")).toBeNull();
    expect(failureScope("netgsm_code_99")).toBeNull();
    expect(failureScope(null)).toBeNull();
    expect(failureScope("")).toBeNull();
  });

  it("classifies every documented code", () => {
    // A code added to the table without a scope cannot happen -- the
    // scope sits next to it -- but a key that stops resolving here can,
    // and it would silently become "we do not know".
    const unclassified = Object.values(NETGSM_ERRORS).filter(
      (e) => failureScope(e.key) === null,
    );

    expect(unclassified).toEqual([]);
  });
});
