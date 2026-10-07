import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listVisitsPage } from "./queries";

// Archiving is reversible, but only if the archived row can still be found.
// The whole of backlog 39 is that it could not be: every visit query filtered
// `archivedAt: null` unconditionally, so a visit archived by mistake left no
// way back except the database. The rule that matters is both halves of the
// filter, so both are pinned here.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.visit.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.visit.count).mockResolvedValue(0 as never);
});

const whereOf = () =>
  vi.mocked(prisma.visit.findMany).mock.calls[0][0]?.where as Record<
    string,
    unknown
  >;

describe("listVisitsPage", () => {
  it("hides archived visits, and visits whose pet or client is archived", async () => {
    await listVisitsPage({ clinicId: "clinic-1" });

    expect(whereOf()).toMatchObject({
      archivedAt: null,
      pet: { archivedAt: null },
      client: { archivedAt: null },
    });
  });

  it("drops all three conditions when archived rows are asked for", async () => {
    await listVisitsPage({ clinicId: "clinic-1", includeArchived: true });

    const where = whereOf();
    // Not just the visit's own flag: leaving the cascade in place would show
    // the archived list minus exactly the visits an archived client took
    // with it, which is the same record still unreachable.
    expect(where).not.toHaveProperty("archivedAt");
    expect(where).not.toHaveProperty("pet");
    expect(where).not.toHaveProperty("client");
    expect(where.clinicId).toBe("clinic-1");
  });

  it("still scopes to the clinic when archived rows are included", async () => {
    await listVisitsPage({
      clinicId: "clinic-1",
      includeArchived: true,
      petId: "pet-1",
    });

    expect(whereOf()).toMatchObject({ clinicId: "clinic-1", petId: "pet-1" });
  });
});
