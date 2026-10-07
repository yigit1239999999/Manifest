import { describe, expect, it } from "vitest";
import { csvAmount, toCsv } from "./csv";

describe("the accountant's CSV", () => {
  it("is semicolon-separated with a BOM, and quotes only what needs it", () => {
    const csv = toCsv([
      ["No", "Müşteri", "Tutar"],
      ["2026-0001", 'Ayşe "Ada" Yılmaz; Kadıköy', "1234,50"],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿No;Müşteri;Tutar\r\n2026-0001;"Ayşe ""Ada"" Yılmaz; Kadıköy";1234,50\r\n');
  });

  it("writes amounts as numbers in the reader's notation, without grouping", () => {
    expect(csvAmount(123_450, "tr")).toBe("1234,50");
    expect(csvAmount(123_450, "en")).toBe("1234.50");
    expect(csvAmount(5, "tr")).toBe("0,05");
  });
});
