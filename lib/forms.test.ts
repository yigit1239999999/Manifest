import { describe, expect, it } from "vitest";
import {
  checkbox,
  optionalDate,
  optionalDateTime,
  optionalEmail,
  optionalEnum,
  optionalFloat,
  optionalInt,
  optionalMoneyCents,
  optionalText,
  requiredEmail,
  requiredEnum,
  requiredInt,
  requiredText,
  toFieldErrors,
} from "./forms";

describe("requiredText", () => {
  const schema = requiredText(2, 10, "Ad");

  it("trims and accepts values within bounds", () => {
    expect(schema.safeParse("  John  ").success).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  it("rejects strings exceeding max length", () => {
    expect(schema.safeParse("a".repeat(11)).success).toBe(false);
  });
});

describe("optionalText", () => {
  it("converts blank input to null", () => {
    const r = optionalText(10).safeParse("");
    expect(r.success && r.data).toBeNull();
  });

  it("keeps trimmed non-blank input", () => {
    const r = optionalText(10).safeParse("  hi  ");
    expect(r.success && r.data).toBe("hi");
  });
});

describe("requiredEmail / optionalEmail", () => {
  it("accepts a valid email", () => {
    expect(requiredEmail.safeParse("a@b.com").success).toBe(true);
    expect(optionalEmail.safeParse("a@b.com").success).toBe(true);
  });

  it("rejects malformed email", () => {
    expect(requiredEmail.safeParse("nope").success).toBe(false);
    expect(optionalEmail.safeParse("nope").success).toBe(false);
  });

  it("optionalEmail accepts blank and returns null", () => {
    const r = optionalEmail.safeParse("");
    expect(r.success && r.data).toBeNull();
  });
});

describe("requiredEnum / optionalEnum", () => {
  const required = requiredEnum(["DOG", "CAT"] as const);
  const optional = optionalEnum(["DOG", "CAT"] as const);

  it("accepts a valid enum value", () => {
    expect(required.safeParse("DOG").success).toBe(true);
    expect(optional.safeParse("CAT").success).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(required.safeParse("DRAGON").success).toBe(false);
    expect(optional.safeParse("DRAGON").success).toBe(false);
  });

  it("optionalEnum converts blank to null", () => {
    const r = optional.safeParse("");
    expect(r.success && r.data).toBeNull();
  });
});

describe("optionalDate / optionalDateTime", () => {
  it("accepts a valid ISO date", () => {
    expect(optionalDate.safeParse("2024-01-15").success).toBe(true);
    expect(optionalDateTime.safeParse("2024-01-15T10:00").success).toBe(true);
  });

  it("rejects garbage", () => {
    expect(optionalDate.safeParse("not-a-date").success).toBe(false);
  });

  it("blank input becomes null", () => {
    const r = optionalDate.safeParse("");
    expect(r.success && r.data).toBeNull();
  });
});

describe("optionalFloat / optionalInt / requiredInt", () => {
  it("accepts numbers within range", () => {
    expect(optionalFloat({ min: 0, max: 10 }).safeParse("3.14").success).toBe(true);
    expect(optionalInt({ min: 0, max: 10 }).safeParse("3").success).toBe(true);
    expect(requiredInt({ min: 1 }).safeParse("5").success).toBe(true);
  });

  it("rejects values out of range", () => {
    expect(optionalFloat({ min: 0, max: 10 }).safeParse("-1").success).toBe(false);
    expect(optionalInt({ min: 0, max: 10 }).safeParse("11").success).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(optionalFloat().safeParse("abc").success).toBe(false);
    expect(requiredInt().safeParse("abc").success).toBe(false);
  });
});

describe("optionalMoneyCents", () => {
  it("converts decimal money into integer cents", () => {
    const r = optionalMoneyCents.safeParse("12.50");
    expect(r.success && r.data).toBe(1250);
  });

  it("accepts comma as decimal separator", () => {
    const r = optionalMoneyCents.safeParse("12,50");
    expect(r.success && r.data).toBe(1250);
  });

  it("blank value is null", () => {
    const r = optionalMoneyCents.safeParse("");
    expect(r.success && r.data).toBeNull();
  });
});

describe("checkbox", () => {
  it("treats 'on' as true", () => {
    const r = checkbox.safeParse("on");
    expect(r.success && r.data).toBe(true);
  });

  it("treats undefined / empty as false", () => {
    expect(checkbox.safeParse(undefined).data).toBe(false);
    expect(checkbox.safeParse("").data).toBe(false);
  });
});

describe("toFieldErrors", () => {
  it("groups Zod issues by their first path segment", () => {
    const schema = requiredText(1, 10, "Ad");
    const result = schema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(Object.keys(errors)).toContain("_form");
    }
  });
});
