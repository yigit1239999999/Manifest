import { describe, expect, it } from "vitest";
import {
  dateOrderEvidence,
  displayPhone,
  phoneKey,
  readDate,
  readMicrochip,
  readPhone,
  readSex,
  readWeight,
  readYesNo,
  splitFullName,
} from "./normalize";

const today = new Date("2026-10-03T09:00:00Z");

describe("phone keys", () => {
  it("reads every way a Turkish mobile number is written as one number", () => {
    const forms = [
      "0532 123 45 67",
      "05321234567",
      "+90 532 123 45 67",
      "+905321234567",
      "0090 532 123 4567",
      "90 532 123 45 67",
      "532 123 45 67",
      "5321234567",
      "(0532) 123-45-67",
    ];
    expect(new Set(forms.map(phoneKey))).toEqual(new Set(["905321234567"]));
  });

  it("refuses what is not a whole Turkish number rather than matching on it", () => {
    expect(phoneKey("123456")).toBeNull();
    expect(phoneKey("0532 123")).toBeNull();
    expect(phoneKey("yok")).toBeNull();
    expect(phoneKey("")).toBeNull();
  });

  it("keeps a foreign number as written internationally", () => {
    expect(phoneKey("+44 20 7946 0958")).toBe("442079460958");
  });

  it("formats a Turkish number the way the clinic would write it", () => {
    expect(displayPhone("+905321234567")).toBe("0532 123 45 67");
    expect(displayPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("splits two numbers in one cell into phone and secondary phone", () => {
    expect(readPhone("0532 111 11 11 / 0216 222 22 22")).toEqual({
      kind: "ok",
      phone: "0532 111 11 11",
      key: "905321111111",
      secondary: "0216 222 22 22",
    });
  });

  it("reports an unreadable phone instead of dropping it silently", () => {
    expect(readPhone("arayınız")).toEqual({ kind: "invalid", raw: "arayınız" });
    expect(readPhone("  ")).toEqual({ kind: "empty" });
  });
});

describe("dates", () => {
  it("reads ISO, dotted day-first, and Excel serial dates", () => {
    expect(readDate("2021-05-12", null, today)).toEqual({ kind: "ok", date: "2021-05-12" });
    expect(readDate("2021-05-12T00:00:00.000Z", null, today)).toEqual({ kind: "ok", date: "2021-05-12" });
    expect(readDate("12.05.2021", null, today)).toEqual({ kind: "ok", date: "2021-05-12" });
    expect(readDate("03.04.2020", null, today)).toEqual({ kind: "ok", date: "2020-04-03" });
    expect(readDate("44328", null, today)).toEqual({ kind: "ok", date: "2021-05-12" });
  });

  it("reads month names in Turkish and English", () => {
    expect(readDate("3 Nisan 2020", null, today)).toEqual({ kind: "ok", date: "2020-04-03" });
    expect(readDate("3 Şubat 2020", null, today)).toEqual({ kind: "ok", date: "2020-02-03" });
    expect(readDate("April 3, 2020", null, today)).toEqual({ kind: "ok", date: "2020-04-03" });
  });

  it("flags a slash date that reads two ways, and never picks one by itself", () => {
    expect(readDate("03/04/2020", null, today)).toEqual({
      kind: "ambiguous",
      raw: "03/04/2020",
      dmy: "2020-04-03",
      mdy: "2020-03-04",
    });
    expect(readDate("03-04-2020", null, today).kind).toBe("ambiguous");
  });

  it("reads an ambiguous date once the order has been chosen", () => {
    expect(readDate("03/04/2020", "DMY", today)).toEqual({ kind: "ok", date: "2020-04-03" });
    expect(readDate("03/04/2020", "MDY", today)).toEqual({ kind: "ok", date: "2020-03-04" });
  });

  it("needs no choice when only one reading is a real date", () => {
    expect(readDate("25/04/2020", null, today)).toEqual({ kind: "ok", date: "2020-04-25" });
    expect(readDate("04/25/2020", null, today)).toEqual({ kind: "ok", date: "2020-04-25" });
    // Same day either way.
    expect(readDate("05/05/2020", null, today)).toEqual({ kind: "ok", date: "2020-05-05" });
  });

  it("refuses dates that do not exist instead of rolling them over", () => {
    expect(readDate("30.02.2021", null, today).kind).toBe("invalid");
    expect(readDate("32.13.2020", null, today).kind).toBe("invalid");
    expect(readDate("geçen yaz", null, today).kind).toBe("invalid");
  });

  it("says a bare year is a year, not a date", () => {
    expect(readDate("2019", null, today)).toEqual({ kind: "invalid", raw: "2019", reason: "yearOnly" });
  });

  it("puts a two-digit year in the window an animal can have been born in", () => {
    expect(readDate("12.05.21", null, today)).toEqual({ kind: "ok", date: "2021-05-12" });
    expect(readDate("12.05.98", null, today)).toEqual({ kind: "ok", date: "1998-05-12" });
  });

  it("counts the evidence for each order without deciding", () => {
    expect(dateOrderEvidence(["25/04/2020", "13/01/2019", "04/25/2020", "03/04/2020", "12.05.2021"])).toEqual({
      dmy: 2,
      mdy: 1,
    });
  });
});

describe("names", () => {
  it("takes the last word as the surname", () => {
    expect(splitFullName("Mehmet Ali  Kaya")).toEqual({ first: "Mehmet Ali", last: "Kaya" });
    expect(splitFullName("Ayşe")).toEqual({ single: "Ayşe" });
    expect(splitFullName("  ")).toBeNull();
  });
});

describe("sex, neutered, weight, microchip", () => {
  it("reads sex in both languages and keeps a neutered note inside it", () => {
    expect(readSex("Dişi")).toEqual({ kind: "ok", sex: "FEMALE", neutered: false });
    expect(readSex("E")).toEqual({ kind: "ok", sex: "MALE", neutered: false });
    expect(readSex("Erkek (kısır)")).toEqual({ kind: "ok", sex: "MALE", neutered: true });
    expect(readSex("female")).toEqual({ kind: "ok", sex: "FEMALE", neutered: false });
    expect(readSex("dişi?")).toEqual({ kind: "invalid", raw: "dişi?" });
  });

  it("reads yes and no the ways a sheet writes them", () => {
    for (const yes of ["Evet", "E", "var", "x", "1", "TRUE", "Kısır"])
      expect(readYesNo(yes)).toEqual({ kind: "ok", value: true });
    for (const no of ["Hayır", "hayir", "yok", "0", "false"])
      expect(readYesNo(no)).toEqual({ kind: "ok", value: false });
    expect(readYesNo("bilmiyorum").kind).toBe("invalid");
  });

  it("reads a decimal comma and a unit", () => {
    expect(readWeight("4,5")).toEqual({ kind: "ok", kg: 4.5 });
    expect(readWeight("4.5 kg")).toEqual({ kind: "ok", kg: 4.5 });
    expect(readWeight("1.012,5")).toEqual({ kind: "invalid", raw: "1.012,5" });
    expect(readWeight("12,5 kg")).toEqual({ kind: "ok", kg: 12.5 });
    expect(readWeight("ağır").kind).toBe("invalid");
    expect(readWeight("-3").kind).toBe("invalid");
  });

  it("refuses a microchip Excel has already rounded", () => {
    expect(readMicrochip("9,00123E+14")).toEqual({ kind: "invalid", raw: "9,00123E+14", reason: "scientific" });
    expect(readMicrochip("900 123 456 789 012")).toEqual({ kind: "ok", chip: "900123456789012" });
  });
});
