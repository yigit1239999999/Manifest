import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    client: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Run interactive transactions against the same mock so call assertions
  // continue to work whether the call went through `prisma.x` or `tx.x`.
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) =>
    cb(prismaMock),
  );
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { clientSchema } from "./schema";
import {
  archiveClient,
  createClient,
  restoreClient,
  updateClient,
} from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const validInput = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@example.com",
  phone: null,
  secondaryPhone: null,
  address: null,
  city: null,
  postalCode: null,
  country: null,
  preferredContact: null,
  preferredLanguage: null,
  notificationsOptIn: true,
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  // Keep `prisma.$transaction(cb)` invoking the callback with the mock
  // itself as the transaction client, so per-test mockResolvedValue calls
  // still match whether the code path uses `prisma.x` or `tx.x`.
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
});

describe("createClient", () => {
  it("scopes the created row to the active clinic", async () => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);

    await createClient(validInput, ctx);

    expect(prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clinicId: "clinic-1", firstName: "Jamie" }),
    });
  });

  it("writes an audit entry on success", async () => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);

    await createClient(validInput, ctx);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "clinic-1",
        action: "CREATE",
        entityType: "Client",
      }),
    });
  });
});

describe("updateClient", () => {
  it("rejects an update for a client outside the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(
      updateClient("c-x", validInput, ctx),
    ).rejects.toBeInstanceOf(AppError);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: "c-x", clinicId: "clinic-1" },
      select: { id: true },
    });
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("updates a client that belongs to the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await updateClient("c-1", validInput, ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: expect.objectContaining({ firstName: "Jamie" }),
    });
  });
});

describe("archiveClient", () => {
  it("refuses to archive a client outside the clinic", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

    await expect(archiveClient("c-x", ctx)).rejects.toBeInstanceOf(AppError);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("sets archivedAt on success and audits the change", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await archiveClient("c-1", ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "ARCHIVE", entityType: "Client" }),
    });
  });
});

// Backlog 36: the marketing consent box left the form, and the column
// stayed. What makes that safe is exactly this — the update path no longer
// mentions the field, so a client who consented keeps their consent through
// every future edit. If `marketingOptIn` ever comes back into
// `clientSchema` without a control in the form, an unticked checkbox sends
// nothing and this write turns every stored `true` into `false`, silently,
// on a field that is a record of what someone agreed to.
describe("a consent nobody asks about any more", () => {
  it("is not written by updateClient", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await updateClient("c-1", validInput, ctx);

    const data = vi.mocked(prisma.client.update).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("marketingOptIn");
  });

  it("is not written by createClient either", async () => {
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);

    await createClient(validInput, ctx);

    const data = vi.mocked(prisma.client.create).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("marketingOptIn");
  });
});

// A question that was never asked is not a "no".
//
// The column has three states (null / true / false) and the form field
// is the only place they can be flattened without anyone noticing: an
// unticked checkbox submits nothing, so "the control was not answered"
// and "the answer is no" arrive as the identical request. When they were
// resolved to the same `false`, every edit of every client recorded a
// refusal nobody had made, on the record of a consent.
//
// Parsed from a real FormData rather than by handing the service an
// object: the flattening happens between the browser and the schema, so
// a test that starts after the schema cannot see it. What is being
// protected is a radio group with nothing selected sending nothing, and
// nothing meaning nothing.
describe("consent that was never given and never refused", () => {
  const form = (entries: Record<string, string>) => {
    const fd = new FormData();
    fd.set("firstName", "Jamie");
    fd.set("lastName", "Rivera");
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    // The one line `lib/action.ts` `parse()` performs on every
    // submission. Imported directly it drags next-auth into a unit test;
    // copied, it is the same call and the FormData above is still the
    // real starting point.
    const result = clientSchema.safeParse(Object.fromEntries(fd));
    if (!result.success) throw new Error(JSON.stringify(result.error.issues));
    return result.data;
  };

  beforeEach(() => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.create).mockResolvedValue({ id: "c-1" } as never);
  });

  it("leaves the stored answer alone when the form did not carry one", async () => {
    await updateClient("c-1", form({}), ctx);

    // `undefined` is not "write undefined": Prisma reads it as "do not
    // touch this column". A stored null stays null, a stored true stays
    // true, and neither becomes false because someone edited an address.
    const data = vi.mocked(prisma.client.update).mock.calls[0][0].data;
    expect(data.notificationsOptIn).toBeUndefined();
  });

  it("writes the answer when the form did carry one", async () => {
    // The other half, and the one that makes the test above meaningful:
    // a field that writes nothing ever would also pass it.
    await updateClient("c-1", form({ notificationsOptIn: "true" }), ctx);
    await updateClient("c-1", form({ notificationsOptIn: "false" }), ctx);

    const calls = vi.mocked(prisma.client.update).mock.calls;
    expect(calls[0][0].data.notificationsOptIn).toBe(true);
    expect(calls[1][0].data.notificationsOptIn).toBe(false);
  });

  it("creates a client nobody has asked yet", async () => {
    await createClient(form({}), ctx);

    // Not false. The default is gone from the column precisely so that a
    // record can be born without an answer in it.
    const data = vi.mocked(prisma.client.create).mock.calls[0][0].data;
    expect(data.notificationsOptIn).toBeUndefined();
  });

  it("does not read an unticked checkbox as a refusal", async () => {
    // The shape the old control sent. It must not mean yes, and it must
    // not mean no: a checkbox cannot express three states, so anything
    // it sends is treated as no answer at all. If someone rewires the
    // form to a checkbox, this is what says so.
    await updateClient("c-1", form({ notificationsOptIn: "on" }), ctx);

    const data = vi.mocked(prisma.client.update).mock.calls[0][0].data;
    expect(data.notificationsOptIn).toBeUndefined();
  });
});

describe("restoreClient", () => {
  it("clears archivedAt on the matching client", async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: "c-1" } as never);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: "c-1" } as never);

    await restoreClient("c-1", ctx);

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { archivedAt: null },
    });
  });
});
