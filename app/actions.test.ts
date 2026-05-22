import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    clinic: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { signInAction, signOutAction, signUpAction } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validSignUp = {
  clinicName: "Sunrise Veterinary Clinic",
  name: "Dr Alex Morgan",
  email: "alex@clinic.com",
  password: "supersecret123",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("signUpAction", () => {
  it("creates a clinic with a hashed password and signs the user in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.clinic.create).mockResolvedValue({ id: "clinic-1" } as never);

    const result = await signUpAction({}, formData(validSignUp));

    expect(result).toEqual({});
    const call = vi.mocked(prisma.clinic.create).mock.calls[0][0] as {
      data: {
        name: string;
        users: { create: { passwordHash: string; role: string; email: string } };
      };
    };
    expect(call.data.name).toBe("Sunrise Veterinary Clinic");
    expect(call.data.users.create.role).toBe("ADMIN");
    expect(call.data.users.create.email).toBe("alex@clinic.com");
    expect(call.data.users.create.passwordHash).not.toBe("supersecret123");
    expect(call.data.users.create.passwordHash.length).toBeGreaterThan(20);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "alex@clinic.com",
      password: "supersecret123",
      redirectTo: "/",
    });
  });

  it("rejects a duplicate email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);

    const result = await signUpAction({}, formData(validSignUp));

    expect(result.fieldErrors?.email?.length).toBeGreaterThan(0);
    expect(prisma.clinic.create).not.toHaveBeenCalled();
  });

  it("returns field errors for a weak password", async () => {
    const result = await signUpAction({}, formData({ ...validSignUp, password: "short" }));

    expect(result.fieldErrors?.password?.length).toBeGreaterThan(0);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("signInAction", () => {
  it("signs in with valid credentials", async () => {
    const result = await signInAction(
      {},
      formData({ email: "alex@clinic.com", password: "supersecret123" }),
    );

    expect(result).toEqual({});
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "alex@clinic.com",
      password: "supersecret123",
      redirectTo: "/",
    });
  });

  it("returns field errors for invalid input", async () => {
    const result = await signInAction({}, formData({ email: "nope", password: "" }));

    expect(result.fieldErrors).toBeDefined();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("returns a friendly error when authentication fails", async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthError("bad credentials"));

    const result = await signInAction(
      {},
      formData({ email: "alex@clinic.com", password: "wrongpassword" }),
    );

    expect(result.error).toBe("Invalid email or password.");
  });
});

describe("signOutAction", () => {
  it("signs the user out back to the sign-in page", async () => {
    await signOutAction();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });
});
