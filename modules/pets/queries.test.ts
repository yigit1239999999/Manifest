import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pet: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listPets, listPetsPage } from "./queries";

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

describe("listPets, the dropdown list", () => {
  // The dropdown cap used to be silent. Past 500 animals the rest simply
  // were not in the picker, search did not help because the picker filters
  // what it was handed, and nothing said so — the list looked complete.
  // Who vanished was not random either: ordered newest-first, it was the
  // oldest animals, which belong to the longest-standing clients.
  it("reads one row past the cap so it can say the list is short", async () => {
    await listPets({ clinicId: "clinic-1", take: 2 });

    expect(callOf()?.take).toBe(3);
  });

  it("reports the cap, and hands back only what was asked for", async () => {
    vi.mocked(prisma.pet.findMany).mockResolvedValue([
      { id: "p-1" },
      { id: "p-2" },
      { id: "p-3" },
    ] as never);

    const { items, hasMore } = await listPets({ clinicId: "clinic-1", take: 2 });

    expect(items).toHaveLength(2);
    expect(hasMore).toBe(true);
  });

  it("says nothing when the list fits", async () => {
    // The hint has to stay off for every clinic that is nowhere near the
    // cap, which is all of them today; a warning everyone sees is one
    // nobody reads.
    vi.mocked(prisma.pet.findMany).mockResolvedValue([{ id: "p-1" }] as never);

    const { items, hasMore } = await listPets({ clinicId: "clinic-1", take: 2 });

    expect(items).toHaveLength(1);
    expect(hasMore).toBe(false);
  });
});
