import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: vi.fn(), count: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { listClients, quickSearchClients } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);
});

const callOf = () => vi.mocked(prisma.client.findMany).mock.calls[0][0];

// The picker was handed the first five hundred clients and filtered them in
// the browser. Past that the rest were not hard to find, they were absent —
// and absent in a pattern, because the list is ordered by surname: every
// Yılmaz gone while every Acar was there. The user reads that as "not a
// client of ours" and opens a second record.
describe("listClients, the picker's list", () => {
  it("reads one row past the cap so the cut can be reported", async () => {
    await listClients({ clinicId: "clinic-1", take: 2 });

    expect(callOf()?.take).toBe(3);
  });

  it("hands back the cap's worth, and says there is more", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      { id: "c-1" },
      { id: "c-2" },
      { id: "c-3" },
    ] as never);

    const { items, hasMore } = await listClients({
      clinicId: "clinic-1",
      take: 2,
    });

    expect(items).toHaveLength(2);
    expect(hasMore).toBe(true);
  });

  it("stays quiet when the list fits", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([{ id: "c-1" }] as never);

    const { hasMore } = await listClients({ clinicId: "clinic-1", take: 2 });

    expect(hasMore).toBe(false);
  });
});

describe("quickSearchClients, the way past the cap", () => {
  it("takes a cap from the caller, so a picker can ask for more than the palette", async () => {
    // Written for the command palette, which wants five. A picker is being
    // chosen from rather than jumped to and wants a screenful. One query
    // either way: two would start disagreeing about what "matches" means.
    await quickSearchClients("clinic-1", "yıl", 20);

    expect(callOf()?.take).toBe(20);
  });

  it("returns nothing below two characters rather than everybody", async () => {
    // A single letter against a whole clinic is not a search, and the
    // first twenty names it would return are not answers. The picker
    // tells "keep typing" from "no matches" by looking at what was typed,
    // so an empty array here is unambiguous.
    const rows = await quickSearchClients("clinic-1", "y", 20);

    expect(rows).toEqual([]);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("searches inside the clinic, never across", async () => {
    await quickSearchClients("clinic-1", "yıl", 20);

    expect(callOf()?.where).toMatchObject({ clinicId: "clinic-1" });
  });
});
