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

    // 21, not 20: the extra row is read and discarded so the answer can
    // say whether it was truncated. See `listClients`, which has read
    // one past its cap since it was written — this is the search path
    // catching up.
    expect(callOf()?.take).toBe(21);
  });

  it("returns nothing below two characters rather than everybody", async () => {
    // A single letter against a whole clinic is not a search, and the
    // first twenty names it would return are not answers. The picker
    // tells "keep typing" from "no matches" by looking at what was typed,
    // so an empty array here is unambiguous.
    const rows = await quickSearchClients("clinic-1", "y", 20);

    expect(rows).toEqual({ items: [], hasMore: false });
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("searches inside the clinic, never across", async () => {
    await quickSearchClients("clinic-1", "yıl", 20);

    expect(callOf()?.where).toMatchObject({ clinicId: "clinic-1" });
  });

  // The form that warns "this client has not agreed to messages" takes
  // clients from two places: the page's own list, and this search once
  // that list is capped. A warning on one path only is worse than none
  // -- right often enough to be trusted, and missing exactly when the
  // clinic grew big enough to cap the list.
  it("carries the consent and the number a form has to warn about", async () => {
    await quickSearchClients("clinic-1", "yıl", 20);

    expect(callOf()?.select).toMatchObject({
      phone: true,
      notificationsOptIn: true,
    });
  });
});

// ILIKE folds case and nothing else, so the server never found "Ayse".
//
// The browser's half was fixed first and it is the smaller half: the
// command palette (`app/api/search/route.ts`) calls `quickSearchClients`
// straight through, with no local list in front of it and no cap to
// cross first, so a clinic of twelve was already being told "no such
// client" about a client it has.
//
// Asserted on the `where`, because that is where the decision now
// lives. The folded term has to reach the query -- a search that folds
// the column and not the term finds nothing at all, which is the same
// silence wearing the opposite mask.
describe("searching for a name typed without Turkish letters", () => {
  it("asks for the folded key, not four case-insensitive columns", async () => {
    await listClients({ clinicId: "clinic-1", search: "Ayşe" });

    const where = callOf()?.where as Record<string, unknown>;
    expect(where.searchKey).toEqual({ contains: "ayse" });
    expect(where.OR).toBeUndefined();
  });

  it("arrives at the same query however the name was typed", async () => {
    // The point of folding both sides: these four are one question.
    for (const typed of ["Ayşe", "Ayse", "AYŞE", "ayse"]) {
      vi.mocked(prisma.client.findMany).mockClear();
      await listClients({ clinicId: "clinic-1", search: typed });
      const where = vi.mocked(prisma.client.findMany).mock.calls[0][0]
        ?.where as Record<string, unknown>;
      expect(where.searchKey).toEqual({ contains: "ayse" });
    }
  });

  it("searches a full name as one term, across two columns", async () => {
    // A second defect, closed by the same column and worth its own
    // line: first and last name are separate columns, so no OR over
    // them can span the space between the words. Measured before the
    // change, "Yiğit Sonbahar" returned nothing -- and so did "Yigit
    // Sonbahar", which is how we know it was never about accents.
    // Typing somebody's full name is the most ordinary thing anyone
    // does in a search box, and it had never once worked.
    //
    // This assertion is what an "unaccent is enough, simplify it"
    // change would have to break first.
    await listClients({ clinicId: "clinic-1", search: "Yiğit Sonbahar" });

    const where = callOf()?.where as Record<string, unknown>;
    expect(where.searchKey).toEqual({ contains: "yigit sonbahar" });
  });

  it("does not filter at all when nothing was typed", async () => {
    // `contains: ""` matches every row, which is the right answer here
    // and the wrong one everywhere it might be mistaken for a search.
    // The empty term has to disappear before it reaches the query.
    await listClients({ clinicId: "clinic-1", search: "   " });

    expect(callOf()?.where).not.toHaveProperty("searchKey");
  });

  it("refuses a single character before it reaches the database", async () => {
    // The palette's floor. One letter matches most of a clinic, and the
    // trigram index cannot help a term shorter than three characters.
    const rows = await quickSearchClients("clinic-1", "a");

    expect(rows.items).toEqual([]);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });
});
