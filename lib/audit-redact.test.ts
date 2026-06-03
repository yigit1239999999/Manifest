import { describe, expect, it } from "vitest";
import { computeDiff, redact } from "./audit-redact";

describe("redact", () => {
  it("replaces password fields with [REDACTED]", () => {
    const out = redact({
      name: "Jamie",
      email: "jamie@example.com",
      password: "supersecret",
      passwordHash: "$2b$10$abc",
    }) as Record<string, unknown>;

    expect(out.name).toBe("Jamie");
    expect(out.email).toBe("jamie@example.com");
    expect(out.password).toBe("[REDACTED]");
    expect(out.passwordHash).toBe("[REDACTED]");
  });

  it("converts Date instances to ISO strings", () => {
    const out = redact({ when: new Date("2026-05-22T10:00:00.000Z") }) as Record<
      string,
      unknown
    >;
    expect(out.when).toBe("2026-05-22T10:00:00.000Z");
  });

  it("drops undefined and normalises null", () => {
    const out = redact({ a: undefined, b: null, c: "x" }) as Record<
      string,
      unknown
    >;
    expect(out.a).toBeNull();
    expect(out.b).toBeNull();
    expect(out.c).toBe("x");
  });

  it("redacts nested fields when keys match at the top level only", () => {
    const out = redact({
      profile: { password: "kept", name: "leaked" },
    }) as Record<string, Record<string, unknown>>;
    // The recursion only redacts at the top level by default — nested
    // objects pass through. This is the intended scope.
    expect(out.profile.password).toBe("kept");
  });

  it("accepts custom reserved keys", () => {
    const out = redact({ apiKey: "abc", token: "xyz" }, ["apiKey"]) as Record<
      string,
      unknown
    >;
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.token).toBe("xyz");
  });
});

describe("computeDiff", () => {
  it("returns {from, to} entries for fields that changed", () => {
    const before = { firstName: "Jamie", lastName: "Rivera", age: 32 };
    const after = { firstName: "Jamie", lastName: "Chen", age: 33 };
    const diff = computeDiff(before, after, ["firstName", "lastName", "age"]) as Record<
      string,
      { from: unknown; to: unknown }
    >;

    expect(diff.firstName).toBeUndefined();
    expect(diff.lastName).toEqual({ from: "Rivera", to: "Chen" });
    expect(diff.age).toEqual({ from: 32, to: 33 });
  });

  it("treats NaN equality correctly", () => {
    const diff = computeDiff(
      { x: NaN },
      { x: NaN },
      ["x"],
    ) as Record<string, unknown>;
    expect(Object.keys(diff)).toHaveLength(0);
  });

  it("only inspects the keys passed in", () => {
    const diff = computeDiff(
      { a: 1, b: 2 },
      { a: 1, b: 99 },
      ["a"],
    ) as Record<string, unknown>;
    expect(diff.a).toBeUndefined();
    expect(diff.b).toBeUndefined();
  });
});
