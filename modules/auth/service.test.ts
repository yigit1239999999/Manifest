import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    clinic: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createClinicWithOwner } from "./service";

const validInput = {
  clinicName: "Sunrise Veterinary Clinic",
  name: "Dr Alex Morgan",
  email: "alex@clinic.com",
  password: "supersecret123",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createClinicWithOwner", () => {
  it("rejects when the email is already in use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-1" } as never);

    await expect(createClinicWithOwner(validInput)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(prisma.clinic.create).not.toHaveBeenCalled();
  });

  it("creates a clinic and admin user with a hashed password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.clinic.create).mockResolvedValue({
      id: "c-1",
      users: [{ id: "u-1", email: "alex@clinic.com" }],
    } as never);

    await createClinicWithOwner(validInput);

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
  });
});
