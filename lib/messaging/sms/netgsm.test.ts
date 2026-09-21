import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SMS_PROVIDER: "netgsm",
    NETGSM_USERCODE: "user",
    NETGSM_PASSWORD: "pass",
    NETGSM_MSGHEADER: "PETTRACK",
  },
}));

import { netgsmTransport } from "./netgsm";
import { TransportError } from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("netgsmTransport", () => {
  it("is configured when provider and credentials are set", () => {
    expect(netgsmTransport.isConfigured()).toBe(true);
  });

  it("posts a TR-encoded message with basic auth and returns the job id", async () => {
    fetchMock.mockResolvedValue(reply(200, { code: "00", jobid: "123456" }));

    const result = await netgsmTransport.send({ to: "905321234567", body: "Merhaba", language: "tr" });

    expect(result).toEqual({ providerId: "123456" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.netgsm.com.tr/sms/rest/v2/send");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
    expect(JSON.parse(init.body)).toEqual({
      msgheader: "PETTRACK",
      encoding: "TR",
      iysfilter: "",
      messages: [{ msg: "Merhaba", no: "905321234567" }],
    });
  });

  it("maps documented error codes to stable transport errors", async () => {
    fetchMock.mockResolvedValue(reply(200, { code: "40", description: "header" }));
    await expect(
      netgsmTransport.send({ to: "905321234567", body: "x", language: "tr" }),
    ).rejects.toMatchObject({ code: "sender_title_not_registered" });
  });

  it("surfaces HTTP failures", async () => {
    fetchMock.mockResolvedValue(reply(503, {}));
    await expect(
      netgsmTransport.send({ to: "905321234567", body: "x", language: "tr" }),
    ).rejects.toBeInstanceOf(TransportError);
  });
});

// The report call, and the one parameter the whole screen rests on.
describe("netgsmTransport.reports", () => {
  const reportBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("asks with version=1, because the buckets collapse without it", async () => {
    // Netgsm folds 11, 12 and 13 into one "timeout" answer unless this
    // is sent. Those three are the difference between "the number is
    // wrong, ask the owner" and "nothing to do", so dropping the
    // parameter silently removes the only bucket with an action on it.
    fetchMock.mockResolvedValue(reply(200, { messages: [{ status: "0", donedate: "2026-09-20 11:00:00" }] }));

    await netgsmTransport.reports!(["job-1"]);

    expect(reportBody()).toEqual({ bulkid: "job-1", version: 1 });
  });

  it("maps the operator's codes onto the four answers a screen can show", async () => {
    const cases: [string, string][] = [
      ["0", "delivered"],
      ["1", "pending"],
      ["12", "undelivered"],
      ["100", "expired"],
    ];
    for (const [code, state] of cases) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(reply(200, { messages: [{ status: code }] }));

      const out = await netgsmTransport.reports!(["job-1"]);

      expect(out["job-1"]).toMatchObject({ state, code });
    }
  });

  it("says nothing about a code it does not know, rather than guessing", async () => {
    // A wrong bucket becomes a wrong sentence on a screen. Absence is
    // read as "we have not heard", which is the truthful fallback.
    fetchMock.mockResolvedValue(reply(200, { messages: [{ status: "999" }] }));

    expect(await netgsmTransport.reports!(["job-1"])).toEqual({});
  });

  it("carries a delivery time only for a delivered message", async () => {
    fetchMock.mockResolvedValue(reply(200, { messages: [{ status: "12", donedate: "2026-09-20 11:00:00" }] }));

    expect((await netgsmTransport.reports!(["job-1"]))["job-1"].at).toBeNull();
  });

  it("asks nothing when there is nothing to ask about", async () => {
    expect(await netgsmTransport.reports!([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
