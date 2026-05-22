import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    owner: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createOwner, deleteOwner, updateOwner } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validOwner = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@example.com",
  phone: "555-0100",
  address: "",
  notes: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireSession).mockResolvedValue({
    user: {
      id: "user-1",
      clinicId: "clinic-1",
      role: "ADMIN",
      name: "Dr Test",
      email: "dr@test.com",
    },
    expires: "2999-01-01",
  } as never);
});

describe("createOwner", () => {
  it("creates an owner scoped to the signed-in clinic", async () => {
    vi.mocked(prisma.owner.create).mockResolvedValue({ id: "owner-1" } as never);

    await createOwner({}, formData(validOwner));

    expect(prisma.owner.create).toHaveBeenCalledTimes(1);
    expect(prisma.owner.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        firstName: "Jamie",
        lastName: "Rivera",
        email: "jamie@example.com",
      }),
    });
    expect(redirect).toHaveBeenCalledWith("/clients/owner-1");
  });

  it("returns field errors and writes nothing when input is invalid", async () => {
    const result = await createOwner(
      {},
      formData({ ...validOwner, firstName: "", lastName: "" }),
    );

    expect(result.fieldErrors?.firstName?.length).toBeGreaterThan(0);
    expect(prisma.owner.create).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("normalizes blank optional fields to null", async () => {
    vi.mocked(prisma.owner.create).mockResolvedValue({ id: "owner-2" } as never);

    await createOwner({}, formData({ ...validOwner, email: "", phone: "   " }));

    const arg = vi.mocked(prisma.owner.create).mock.calls[0][0] as {
      data: { email: unknown; phone: unknown };
    };
    expect(arg.data.email).toBeNull();
    expect(arg.data.phone).toBeNull();
  });
});

describe("updateOwner", () => {
  it("refuses to update an owner from another clinic", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue(null);

    const result = await updateOwner("owner-x", {}, formData(validOwner));

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-x", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(result.error).toBeDefined();
    expect(prisma.owner.update).not.toHaveBeenCalled();
  });

  it("updates an owner that belongs to the clinic", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.owner.update).mockResolvedValue({ id: "owner-1" } as never);

    await updateOwner("owner-1", {}, formData(validOwner));

    expect(prisma.owner.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: expect.objectContaining({ firstName: "Jamie", lastName: "Rivera" }),
    });
    expect(redirect).toHaveBeenCalledWith("/clients/owner-1");
  });
});

describe("deleteOwner", () => {
  it("does not delete an owner from another clinic", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue(null);

    await deleteOwner("owner-x");

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-x", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(prisma.owner.delete).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/clients");
  });

  it("deletes an owner that belongs to the clinic", async () => {
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1" } as never);
    vi.mocked(prisma.owner.delete).mockResolvedValue({ id: "owner-1" } as never);

    await deleteOwner("owner-1");

    expect(prisma.owner.delete).toHaveBeenCalledWith({ where: { id: "owner-1" } });
  });
});
