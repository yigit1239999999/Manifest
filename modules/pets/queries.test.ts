import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pet: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listPetsPage } from "./queries";

// See `modules/visits/queries.test.ts`: an archive nobody can list is an
// archive nobody can undo (backlog 39).
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.pet.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.pet.count).mockResolvedValue(0 as never);
});

const callOf = () => vi.mocked(prisma.pet.findMany).mock.calls[0][0];
const whereOf = () => callOf()?.where as Record<string, unknown>;

describe("listPetsPage", () => {
  it("hides archived pets, and pets whose owner is archived", async () => {
    await listPetsPage({ clinicId: "clinic-1" });

    expect(whereOf()).toMatchObject({
      archivedAt: null,
      owner: { archivedAt: null },
    });
  });

  it("drops both conditions when archived rows are asked for", async () => {
    await listPetsPage({ clinicId: "clinic-1", includeArchived: true });

    const where = whereOf();
    expect(where).not.toHaveProperty("archivedAt");
    expect(where).not.toHaveProperty("owner");
    expect(where.clinicId).toBe("clinic-1");
  });

  it("selects the owner's archivedAt, which the card needs to explain itself", async () => {
    // A pet archived by its owner has `archivedAt: null` of its own. Without
    // this field the list would show it unmarked among live rows.
    await listPetsPage({ clinicId: "clinic-1", includeArchived: true });

    const include = callOf()?.include as
      | { owner?: { select?: Record<string, unknown> } }
      | undefined;
    expect(include?.owner?.select).toMatchObject({ archivedAt: true });
  });
});
