import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { SMS_PROVIDER: "log" } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

import { logTransport } from "./log";

// The fabricated reports are this provider's behaviour, not test data.
// A transport that answered "delivered" to everything would leave the
// three states a vet acts on unrendered for the whole of development --
// which is exactly how the failed-send sentence came to be written,
// tested, and never once seen.
describe("logTransport.reports", () => {
  const ids = Array.from({ length: 200 }, (_, i) => `log-${i}`);

  it("produces every state a real operator produces", async () => {
    const states = new Set(
      Object.values(await logTransport.reports!(ids)).map((r) => r.state),
    );

    expect(states).toEqual(new Set(["delivered", "undelivered", "pending"]));
  });

  it("gives the same answer about the same message twice", async () => {
    // A poller runs repeatedly. If the answer moved, a message would
    // read as delivered on one run and pending on the next, and the
    // screen would flicker between two truths.
    const first = await logTransport.reports!(ids);
    const second = await logTransport.reports!(ids);

    expect(Object.entries(second).map(([k, v]) => [k, v.state])).toEqual(
      Object.entries(first).map(([k, v]) => [k, v.state]),
    );
  });

  it("dates only the delivered ones", async () => {
    const reports = Object.values(await logTransport.reports!(ids));

    for (const r of reports) {
      if (r.state === "delivered") expect(r.at).toBeInstanceOf(Date);
      else expect(r.at).toBeNull();
    }
  });

  it("answers nothing about a message it never sent", async () => {
    // A real provider has no record of another provider's job id, and
    // "no record" must not be reported as a failed delivery.
    expect(await logTransport.reports!(["netgsm-4242"])).toEqual({});
  });
});
