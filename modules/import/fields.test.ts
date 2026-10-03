import { describe, expect, it } from "vitest";
import { autoMap, headerKey, missingRequired, sanitizeMapping } from "./fields";

describe("headerKey", () => {
  it("folds Turkish letters and punctuation into one comparable form", () => {
    expect(headerKey("Doğum Tarihi")).toBe("dogum tarihi");
    expect(headerKey("ÇİP NO")).toBe("cip no");
    expect(headerKey("E-posta")).toBe("e posta");
    expect(headerKey("  Ağırlık (kg) ")).toBe("agirlik kg");
  });
});

describe("autoMap", () => {
  it("maps the headers a Turkish clinic actually writes", () => {
    const headers = [
      "Sahip Adı",
      "Cep",
      "E-posta",
      "Hayvan Adı",
      "Tür",
      "Irk",
      "Cinsiyet",
      "Doğum Tarihi",
      "Çip No",
      "Kısır",
      "Kilo",
    ];
    expect(autoMap(headers)).toEqual([
      "ownerName",
      "phone",
      "email",
      "petName",
      "species",
      "breed",
      "sex",
      "birthDate",
      "microchip",
      "neutered",
      "weight",
    ]);
  });

  it("maps English exports too", () => {
    expect(
      autoMap(["Client Name", "Phone Number", "Email", "Patient Name", "Species", "Breed", "Date of Birth"]),
    ).toEqual(["ownerName", "phone", "email", "petName", "species", "breed", "birthDate"]);
  });

  it("reads 'Müşteri' as the owner and 'Telefon' as the phone", () => {
    expect(autoMap(["Müşteri", "Telefon"])).toEqual(["ownerName", "phone"]);
  });

  it("prefers the more specific reading of a longer header", () => {
    // "Son Aşı Tarihi" contains "Son Aşı" but is the date, not the name.
    expect(autoMap(["Son Aşı", "Son Aşı Tarihi", "Sonraki Aşı Tarihi"])).toEqual([
      "vaccineName",
      "vaccineDate",
      "vaccineNextDue",
    ]);
  });

  it("matches a header that contains a synonym among other words", () => {
    expect(autoMap(["Müşteri Cep Telefonu", "Hayvanın Mikroçip Numarası"])).toEqual([
      "phone",
      "microchip",
    ]);
  });

  it("reads 'Cins' as a breed, never as a species", () => {
    expect(autoMap(["Cinsi"])).toEqual(["breed"]);
  });

  it("does not let a short word inside a longer header claim it", () => {
    // "Ad" is a first name on its own, and part of "Hayvan Adı" too.
    expect(autoMap(["Hayvan Adı", "Ad", "Soyad"])).toEqual([
      "petName",
      "ownerFirstName",
      "ownerLastName",
    ]);
  });

  it("gives each field to one column only, the first one", () => {
    expect(autoMap(["Telefon", "Tel"])).toEqual(["phone", null]);
  });

  it("leaves what it does not recognise unmapped rather than guessing", () => {
    expect(autoMap(["Kayıt No", "", "Veteriner"])).toEqual([null, null, null]);
  });
});

describe("missingRequired", () => {
  it("asks for an owner name, a pet name and a species", () => {
    expect(missingRequired([null])).toEqual(["ownerName", "petName", "species"]);
  });

  it("accepts separate first and last name columns for the owner", () => {
    expect(missingRequired(["ownerFirstName", "ownerLastName", "petName", "species"])).toEqual([]);
    expect(missingRequired(["ownerFirstName", "petName", "species"])).toEqual(["ownerName"]);
  });
});

describe("sanitizeMapping", () => {
  it("drops unknown names and a field claimed twice, and fits the column count", () => {
    expect(sanitizeMapping(["phone", "phone", "clinicId", 4], 5)).toEqual([
      "phone",
      null,
      null,
      null,
      null,
    ]);
    expect(sanitizeMapping("nonsense", 2)).toEqual([null, null]);
  });
});
