import { describe, expect, it } from "vitest";
import { can, requirePermission } from "./permissions";
import { AppError } from "./errors";

describe("can()", () => {
  it("grants admins every permission", () => {
    expect(can("ADMIN", "users.manage")).toBe(true);
    expect(can("ADMIN", "invoices.void")).toBe(true);
    expect(can("ADMIN", "prescriptions.write")).toBe(true);
  });

  it("lets veterinarians prescribe but not manage users", () => {
    expect(can("VETERINARIAN", "prescriptions.write")).toBe(true);
    expect(can("VETERINARIAN", "visits.write")).toBe(true);
    expect(can("VETERINARIAN", "users.manage")).toBe(false);
    expect(can("VETERINARIAN", "invoices.void")).toBe(false);
  });

  it("stops vet techs from prescribing or modifying invoices", () => {
    expect(can("VET_TECH", "prescriptions.write")).toBe(false);
    expect(can("VET_TECH", "invoices.write")).toBe(false);
    expect(can("VET_TECH", "vaccinations.write")).toBe(true);
    expect(can("VET_TECH", "notes.write")).toBe(true);
  });

  it("limits receptionists to non-clinical work", () => {
    expect(can("RECEPTIONIST", "appointments.write")).toBe(true);
    expect(can("RECEPTIONIST", "payments.write")).toBe(true);
    expect(can("RECEPTIONIST", "prescriptions.write")).toBe(false);
    expect(can("RECEPTIONIST", "visits.write")).toBe(false);
  });

  it("denies unknown roles and missing roles", () => {
    expect(can(undefined, "clients.read")).toBe(false);
    expect(can("OWNER", "clients.read")).toBe(false);
  });
});

describe("requirePermission()", () => {
  it("does nothing when the role has the permission", () => {
    expect(() => requirePermission("ADMIN", "users.manage")).not.toThrow();
  });

  it("throws an AppError with FORBIDDEN otherwise", () => {
    try {
      requirePermission("RECEPTIONIST", "prescriptions.write");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });
});
