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
