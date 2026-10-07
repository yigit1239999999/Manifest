import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { aiMatchColumns, type MatchClient } from "./ai-match";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

/**
 * The model is never called here. The client is a fake that records what
 * it was asked, so these tests hold the two promises that matter without
 * a key or a network: what leaves is masked, and anything short of a clean
 * answer degrades to "no suggestion" rather than to an error.
 */
function fakeClient(answer: unknown, stop = "end_turn") {
  const create = vi.fn().mockResolvedValue({
    stop_reason: stop,
    content: [{ type: "text", text: JSON.stringify(answer) }],
  });
  return { client: { beta: { messages: { create } } } as unknown as MatchClient, create };
}

const COLUMNS = [
  { columnIndex: 0, heading: "Kolon1", kind: "text", samples: ["Ayşe Çelik", "Mehmet Kaya"] },
  { columnIndex: 1, heading: "Kolon2", kind: "phone", samples: ["0532 111 22 33"] },
];

describe("what leaves", () => {
  it("sends headings and masked samples, never a real value", async () => {
    const { client, create } = fakeClient({ columns: [] });
    await aiMatchColumns(COLUMNS, client);
    const body = JSON.stringify(create.mock.calls[0][0]);
    expect(body).not.toContain("Ayşe");
    expect(body).not.toContain("111 22 33");
    expect(body).toContain("Xxxx Xxxxx");
    expect(body).toContain("0XXX XXX XX XX");
  });

  it("asks the default model with structured output, low effort and refusal fallbacks", async () => {
    const { client, create } = fakeClient({ columns: [] });
    await aiMatchColumns(COLUMNS, client);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.fallbacks).toBe("default");
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("tool_choice");
  });
});

describe("what comes back", () => {
  it("keeps the columns it was asked about, with a field it knows", async () => {
    const { client } = fakeClient({
      columns: [
        { columnIndex: 0, field: "client.firstName", vaccineName: null, confidence: "high", reason: "Ad soyad biçiminde" },
        { columnIndex: 1, field: "client.phone", vaccineName: null, confidence: "medium", reason: "Telefon biçiminde" },
        { columnIndex: 9, field: "pet.name", vaccineName: null, confidence: "high", reason: "sorulmadı" },
        { columnIndex: 1, field: "not.a.field", vaccineName: null, confidence: "high", reason: "" },
      ],
    });
    const out = await aiMatchColumns(COLUMNS, client);
    expect(out?.map((s) => [s.columnIndex, s.field, s.confidence])).toEqual([
      [0, "client.firstName", "high"],
      [1, "client.phone", "medium"],
      [1, null, "high"],
    ]);
  });

  it("is no suggestion at all when the model refuses", async () => {
    const { client } = fakeClient({ columns: [] }, "refusal");
    expect(await aiMatchColumns(COLUMNS, client)).toBeNull();
  });

  it("is no suggestion at all on a rate limit or an API error", async () => {
    for (const error of [
      new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()),
      new Anthropic.APIError(500, undefined, "boom", new Headers()),
      new Error("network"),
    ]) {
      const client = { beta: { messages: { create: vi.fn().mockRejectedValue(error) } } } as unknown as MatchClient;
      expect(await aiMatchColumns(COLUMNS, client)).toBeNull();
    }
  });

  it("does not call anything without a client, which is the no-key case", async () => {
    expect(await aiMatchColumns(COLUMNS, null)).toBeNull();
  });
});
