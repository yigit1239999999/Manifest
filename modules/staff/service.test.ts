import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createStaff, setStaffActive } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Admin",
  userRole: "ADMIN",
};

const validInput = {
  name: "Dr Yiğit Sonbahar",
  email: "yigit@clinic.com",
  role: "VETERINARIAN" as const,
  phone: null,
  password: "supersecret123",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
});

describe("createStaff", () => {
  it("rejects a non-admin role", async () => {
    await expect(
      createStaff(validInput, { ...ctx, userRole: "RECEPTIONIST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects when the email is already in use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u-9" } as never);

    await expect(createStaff(validInput, ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("scopes the new user to the clinic and hashes the password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u-1" } as never);

    await createStaff(validInput, ctx);

    const call = vi.mocked(prisma.user.create).mock.calls[0][0] as {
      data: { clinicId: string; passwordHash: string; role: string };
    };
    expect(call.data.clinicId).toBe("clinic-1");
    expect(call.data.role).toBe("VETERINARIAN");
    expect(call.data.passwordHash).not.toBe("supersecret123");
    expect(call.data.passwordHash.length).toBeGreaterThan(20);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CREATE", entityType: "User" }),
    });
  });
});

describe("setStaffActive", () => {
  it("refuses to toggle a user outside the clinic", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(setStaffActive("u-x", false, ctx)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("deactivates a clinic user and audits an ARCHIVE", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u-1",
      role: "VETERINARIAN",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "u-1" } as never);

    await setStaffActive("u-1", false, ctx);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { active: false },
      select: { id: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ARCHIVE", entityType: "User" }),
    });
  });

  // Locking every administrator out of a clinic cannot be undone from
  // inside it: the way back is a hand-written database update.
  it("refuses to deactivate the last active administrator", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u-1",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    await expect(setStaffActive("u-1", false, ctx)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows deactivating an administrator while another one is left", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u-1",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "u-1" } as never);

    await setStaffActive("u-1", false, ctx);

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        clinicId: "clinic-1",
        role: "ADMIN",
        active: true,
        id: { not: "u-1" },
      },
    });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  // Reactivation is not a lock-out risk and must not be blocked by the guard.
  it("reactivates without counting administrators", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u-1",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "u-1" } as never);

    await setStaffActive("u-1", true, ctx);

    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RESTORE", entityType: "User" }),
    });
  });
});
