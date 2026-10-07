import { describe, expect, it } from "vitest";
import { vetWithTitle } from "./vet-title";

describe("a vet's name on a printed document", () => {
  it("carries the title in the reader's language", () => {
    expect(vetWithTitle("Deniz Kaya", "VETERINARIAN", "tr")).toBe("Vet. Hek. Deniz Kaya");
    expect(vetWithTitle("Deniz Kaya", "VETERINARIAN", "en")).toBe("Dr. Deniz Kaya");
  });

  it("is not doubled when the name already has one, and not given to someone who is not a vet", () => {
    expect(vetWithTitle("Dr. Ayşe Demir", "VETERINARIAN", "tr")).toBe("Dr. Ayşe Demir");
    expect(vetWithTitle("Selin Ak", "RECEPTIONIST", "tr")).toBe("Selin Ak");
  });
});
