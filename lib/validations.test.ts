import { describe, expect, it } from "vitest";
import {
  ownerSchema,
  petSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "@/lib/validations";

const validOwner = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

const validPet = {
  name: "Biscuit",
  species: "DOG",
  ownerId: "owner-1",
  breed: "",
  sex: "UNKNOWN",
  birthDate: "",
  color: "",
  weightKg: "",
  microchipId: "",
  notes: "",
};

describe("ownerSchema", () => {
  it("accepts a valid owner", () => {
    expect(ownerSchema.safeParse(validOwner).success).toBe(true);
  });

  it("requires first and last name", () => {
    const result = ownerSchema.safeParse({
      ...validOwner,
      firstName: "",
      lastName: "",
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = ownerSchema.safeParse({ ...validOwner, firstName: "  Jamie  " });
    expect(result.success && result.data.firstName).toBe("Jamie");
  });

  it("allows a blank email but rejects a malformed one", () => {
    expect(ownerSchema.safeParse({ ...validOwner, email: "" }).success).toBe(true);
    expect(ownerSchema.safeParse({ ...validOwner, email: "good@mail.com" }).success).toBe(
      true,
    );
    expect(ownerSchema.safeParse({ ...validOwner, email: "not-an-email" }).success).toBe(
      false,
    );
  });
});

describe("petSchema", () => {
  it("accepts a valid pet", () => {
    expect(petSchema.safeParse(validPet).success).toBe(true);
  });

  it("requires a name, species and owner", () => {
    expect(petSchema.safeParse({ ...validPet, name: "" }).success).toBe(false);
    expect(petSchema.safeParse({ ...validPet, ownerId: "" }).success).toBe(false);
  });

  it("rejects an unknown species", () => {
    expect(petSchema.safeParse({ ...validPet, species: "DRAGON" }).success).toBe(false);
  });

  it("validates the optional weight", () => {
    expect(petSchema.safeParse({ ...validPet, weightKg: "12.5" }).success).toBe(true);
    expect(petSchema.safeParse({ ...validPet, weightKg: "" }).success).toBe(true);
    expect(petSchema.safeParse({ ...validPet, weightKg: "abc" }).success).toBe(false);
    expect(petSchema.safeParse({ ...validPet, weightKg: "-3" }).success).toBe(false);
  });

  it("validates the optional birth date", () => {
    expect(petSchema.safeParse({ ...validPet, birthDate: "2024-01-15" }).success).toBe(
      true,
    );
    expect(petSchema.safeParse({ ...validPet, birthDate: "" }).success).toBe(true);
    expect(petSchema.safeParse({ ...validPet, birthDate: "nonsense" }).success).toBe(
      false,
    );
  });
});

describe("signUpSchema", () => {
  const validSignUp = {
    clinicName: "Sunrise Veterinary Clinic",
    name: "Dr Alex Morgan",
    email: "alex@clinic.com",
    password: "supersecret",
  };

  it("accepts valid sign-up details", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it("requires a password of at least 8 characters", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, password: "short" }).success).toBe(
      false,
    );
  });

  it("requires a valid email", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, email: "nope" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects a missing password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("toFieldErrors", () => {
  it("maps Zod issues to a field-keyed record", () => {
    const result = ownerSchema.safeParse({ ...validOwner, firstName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error);
      expect(fieldErrors.firstName?.length).toBeGreaterThan(0);
    }
  });
});
