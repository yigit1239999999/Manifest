import { describe, expect, it } from "vitest";
import { findAllergyConflict } from "./allergy-check";

describe("findAllergyConflict", () => {
  it("catches the vet's case: amoxicillin allergy, amoxicillin-clavulanate", () => {
    expect(
      findAllergyConflict("AMOKSİSİLİN ALERJİSİ", "Amoksisilin + Klavulanik asit"),
    ).toEqual({
      allergy: "AMOKSİSİLİN ALERJİSİ",
      drug: "Amoksisilin + Klavulanik asit",
      family: null,
    });
  });

  it("ignores case and Turkish letters on both sides", () => {
    expect(findAllergyConflict("amoksisilin alerjisi", "AMOKSİSİLİN")).not.toBeNull();
    expect(findAllergyConflict("AMOKSISILIN", "amoksısılın 250 mg")).not.toBeNull();
    expect(findAllergyConflict("Meloksikam reaksiyonu", "MELOKSİKAM")).not.toBeNull();
  });

  it("finds a drug glued to its partner", () => {
    expect(
      findAllergyConflict("Amoksisilin alerjisi", "Amoksisilin-klavulanat"),
    ).not.toBeNull();
    expect(
      findAllergyConflict("Penisilin alerjisi", "amoksisilinklavulanat"),
    ).toMatchObject({ family: "penicillin" });
  });

  it("matches through the penicillin family both ways", () => {
    expect(findAllergyConflict("Penisilin alerjisi", "Amoksisilin + Klavulanik asit"))
      .toMatchObject({ allergy: "Penisilin alerjisi", family: "penicillin" });
    expect(findAllergyConflict("AMOKSİSİLİN ALERJİSİ", "Ampisilin"))
      .toMatchObject({ family: "penicillin" });
    expect(findAllergyConflict("penicillin allergy", "Benzatin penisilin"))
      .toMatchObject({ family: "penicillin" });
  });

  it("treats the English spelling as the same drug", () => {
    expect(findAllergyConflict("Amoksisilin alerjisi", "Amoxicillin"))
      .toMatchObject({ family: null });
  });

  it("matches sulfonamides, and not a sulphate salt", () => {
    expect(findAllergyConflict("Sulfa alerjisi", "Trimetoprim + Sulfametoksazol"))
      .toMatchObject({ family: "sulfonamide" });
    expect(findAllergyConflict("Sülfonamid alerjisi", "Sulfadimetoksin"))
      .toMatchObject({ family: "sulfonamide" });
    expect(findAllergyConflict("Sulfa alerjisi", "Gentamisin sülfat")).toBeNull();
    expect(findAllergyConflict("Sulfa alerjisi", "Atropin sülfat")).toBeNull();
  });

  it("matches NSAIDs written as the Turkish abbreviation", () => {
    expect(findAllergyConflict("NSAİİ hassasiyeti", "Meloksikam"))
      .toMatchObject({ family: "nsaid" });
    expect(findAllergyConflict("Karprofen sonrası kusma", "Robenakoksib"))
      .toMatchObject({ family: "nsaid" });
  });

  it("quotes the statement that matched, not the whole field", () => {
    expect(
      findAllergyConflict("Isırır; ağızlık takın. Penisilin alerjisi", "Ampisilin"),
    ).toMatchObject({ allergy: "Penisilin alerjisi" });
  });

  it("stays quiet when nothing matches", () => {
    expect(findAllergyConflict("Penisilin alerjisi", "Enrofloksasin")).toBeNull();
    expect(findAllergyConflict("Isırır, ağızlık takın", "Amoksisilin")).toBeNull();
    expect(findAllergyConflict("Penisilin alerjisi", "Meloksikam")).toBeNull();
    expect(findAllergyConflict("NSAİİ hassasiyeti", "Amoksisilin")).toBeNull();
    // The allergy vocabulary itself is never the match.
    expect(findAllergyConflict("Alerjisi var", "Alerji kremi")).toBeNull();
    // Nor a form word every drug name carries.
    expect(findAllergyConflict("Klavulanik asit tablet alerjisi", "Tolfenamik asit tablet"))
      .toBeNull();
  });

  it("does not extend the families past what they name", () => {
    // Penicillin to cephalosporin is a clinical judgement, not a lookup.
    expect(findAllergyConflict("Penisilin alerjisi", "Sefaleksin")).toBeNull();
    // Metamizole is not an M01A NSAID.
    expect(findAllergyConflict("NSAİİ hassasiyeti", "Metamizol")).toBeNull();
  });

  it("has nothing to say without alerts or a drug", () => {
    expect(findAllergyConflict(null, "Amoksisilin")).toBeNull();
    expect(findAllergyConflict("  ", "Amoksisilin")).toBeNull();
    expect(findAllergyConflict("Penisilin alerjisi", "")).toBeNull();
  });
});
