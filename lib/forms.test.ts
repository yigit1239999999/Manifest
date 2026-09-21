import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  msg,
  checkbox,
  optionalDate,
  optionalDateTime,
  optionalEmail,
  optionalEnum,
  optionalFloat,
  optionalInt,
  optionalMoney,
  optionalPhone,
  requiredMoney,
  optionalText,
  requiredEmail,
  requiredEnum,
  requiredInt,
  requiredText,
  toFieldErrors,
  tristate,
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

describe("money helpers", () => {
  it("converts an amount written in the locale into integer cents", () => {
    expect(optionalMoney("tr").safeParse("12,50").data).toBe(1250);
    expect(optionalMoney("en").safeParse("12.50").data).toBe(1250);
  });

  // The other locale's notation is refused rather than guessed at: in
  // Turkish "12.50" groups thousands, and "12.50" is not a valid grouping.
  it("refuses the other locale's decimal separator", () => {
    expect(optionalMoney("tr").safeParse("12.50").success).toBe(false);
    expect(optionalMoney("en").safeParse("12,50").success).toBe(false);
  });

  it("blank value is null", () => {
    const r = optionalMoney("tr").safeParse("");
    expect(r.success && r.data).toBeNull();
  });

  // The bug this rule exists for: a whole-lira amount used to be stored as
  // its own cent count, so 500 became 5,00.
  it("reads a whole amount as units, not as cents", () => {
    const r = requiredMoney("tr").safeParse("500");
    expect(r.success && r.data).toBe(50_000);
  });

  it("reads a thousands separator instead of dividing by a thousand", () => {
    const r = requiredMoney("tr").safeParse("1.234,56");
    expect(r.success && r.data).toBe(123456);
  });

  it("bounds are expressed in cents", () => {
    expect(requiredMoney("tr", { minCents: 1 }).safeParse("0").success).toBe(false);
    expect(requiredMoney("tr", { maxCents: 10_000 }).safeParse("100").success).toBe(true);
    expect(requiredMoney("tr", { maxCents: 10_000 }).safeParse("100,01").success).toBe(
      false,
    );
  });

  it("rejects an unreadable amount instead of storing a guess", () => {
    expect(requiredMoney("tr").safeParse("").success).toBe(false);
    expect(requiredMoney("tr").safeParse("abc").success).toBe(false);
    expect(requiredMoney("tr").safeParse("-5").success).toBe(false);
  });
});

describe("optionalPhone", () => {
  it("keeps the number as the user wrote it", () => {
    const r = optionalPhone().safeParse(" 0532 123 45 67 ");
    expect(r.success && r.data).toBe("0532 123 45 67");
  });

  it("blank stays blank", () => {
    expect(optionalPhone().safeParse("").data).toBeNull();
    expect(optionalPhone().safeParse(undefined).data).toBeNull();
  });

  // A note in a phone field is not a phone number: it used to be stored and
  // then silently skipped when a message was due.
  it("rejects a note written where a number belongs", () => {
    expect(optionalPhone().safeParse("sabit hat yok").success).toBe(false);
    expect(optionalPhone().safeParse("0532").success).toBe(false);
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

describe("tristate", () => {
  // Three answers, and the third one is the whole reason the helper
  // exists: a question that has not been put to anyone yet. `checkbox`
  // above cannot hold it -- an unticked box and an unasked question
  // reach the server as the same empty request, and reading both as
  // `false` writes a refusal nobody made.
  it("carries yes and no", () => {
    expect(tristate.safeParse("true").data).toBe(true);
    expect(tristate.safeParse("false").data).toBe(false);
  });

  it("says nothing when nothing was answered", () => {
    // `undefined` and not `null`: Prisma writes null, and skips
    // undefined. The distinction is the feature.
    expect(tristate.safeParse(undefined).data).toBeUndefined();
    expect(tristate.safeParse("").data).toBeUndefined();
  });

  it("does not accept a checkbox's answer", () => {
    // "on" is what a checkbox sends. Treating it as yes would make the
    // helper work with a control that can never send no, so consent
    // could be given and never withdrawn.
    expect(tristate.safeParse("on").data).toBeUndefined();
  });
});

describe("fields the form never rendered", () => {
  // `Object.fromEntries(formData)` simply omits a control that is not in the
  // DOM, so every helper has to survive an undefined value.
  it("optional helpers treat a missing key as blank", () => {
    expect(optionalText(10).safeParse(undefined).data).toBeNull();
    expect(optionalEmail.safeParse(undefined).data).toBeNull();
    expect(optionalEnum(["DOG", "CAT"] as const).safeParse(undefined).data).toBeNull();
    expect(optionalDate.safeParse(undefined).data).toBeNull();
    expect(optionalDateTime.safeParse(undefined).data).toBeNull();
    expect(optionalFloat().safeParse(undefined).data).toBeNull();
    expect(optionalInt().safeParse(undefined).data).toBeNull();
    expect(optionalMoney("tr").safeParse(undefined).data).toBeNull();
  });

  it("required helpers report a missing key as required", () => {
    const result = requiredText(1, 10, "pet.name").safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("error.form.required");
    }
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

describe("missing form fields", () => {
  it("treats an absent optional field as empty", () => {
    const schema = z.object({ visitId: optionalText(40), note: optionalText(10) });
    expect(schema.parse({})).toEqual({ visitId: null, note: null });
  });

  it("reports an absent required field with the field's own message", () => {
    // The field label is a translation key too, so the message arrives
    // encoded and the action wrapper resolves it in the request's locale.
    const schema = z.object({ name: requiredText(1, 80, "vaccination.name") });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        msg("error.form.required", { field: "vaccination.name" }),
      );
  });

  it("treats an absent optional enum or date as null", () => {
    const schema = z.object({ kind: optionalEnum(["A", "B"] as const), at: optionalDateTime });
    expect(schema.parse({})).toEqual({ kind: null, at: null });
  });
});
