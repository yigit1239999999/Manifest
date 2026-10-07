import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn(), vaccination: { count: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { dueWindow, listRecalls, parseRecallFilters } from "./recall";

const now = new Date("2026-10-07T09:00:00Z");

/** The SQL text and bound values of the n-th raw query. */
function query(n: number) {
  const sql = vi.mocked(prisma.$queryRaw).mock.calls[n][0] as unknown as {
    sql: string;
    values: unknown[];
  };
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$queryRaw).mockImplementation((async (q: { sql: string }) =>
    q.sql.includes("COUNT(*)::int AS total") ? [{ total: 3 }] : []) as never);
});

describe("parseRecallFilters", () => {
  it("falls back to the dashboard card's own window", () => {
    expect(parseRecallFilters({})).toEqual({
      view: "overdue",
      age: "recent",
      vaccine: null,
      species: null,
      contact: null,
      sort: "due",
    });
  });

  it("drops values nobody offered instead of passing them on", () => {
    const f = parseRecallFilters({ view: "x", age: "1; drop", species: "dog'--", sort: "id" });
    expect(f.view).toBe("overdue");
    expect(f.age).toBe("recent");
    expect(f.species).toBeNull();
    expect(f.sort).toBe("due");
  });
});

describe("listRecalls", () => {
  it("is tenant-scoped and keeps every layer of the dashboard's rule", async () => {
    const { total } = await listRecalls({ clinicId: "clinic-1", view: "overdue", now });
    expect(total).toBe(3);
    const { text, values } = query(0);
    expect(text).toContain('v."clinicId" = ?');
    expect(values).toContain("clinic-1");
    expect(text).toContain('v."dueDismissedAt" IS NULL');
    // A later dose of the same vaccine has answered it (`./supersede.ts`).
    expect(text).toContain('v."supersededById" IS NULL');
    expect(text).toContain('p."deceased" = false AND p."archivedAt" IS NULL AND c."archivedAt" IS NULL');
  });

  // pm B2: booked from the overdue card, the row did not change and stayed
  // on top. The booking sorts it below the rows still waiting for a call,
  // whatever sort the reader chose.
  it.each(["due", "pet", "owner"] as const)("puts booked animals last when sorted by %s", async (sort) => {
    await listRecalls({ clinicId: "clinic-1", view: "overdue", sort, now });
    expect(query(0).text).toMatch(/ORDER BY \(appt\.id IS NOT NULL\) ASC/);
  });

  it("filters by vaccine name as a bound value", async () => {
    await listRecalls({ clinicId: "clinic-1", view: "overdue", vaccine: "Kuduz'; --", now });
    expect(query(0).text).toContain("v.name = ?");
    expect(query(0).values).toContain("Kuduz'; --");
  });
});

describe("dueWindow", () => {
  it("looks thirty days ahead for upcoming, and no further", () => {
    const sql = dueWindow("upcoming", "recent", now) as unknown as { values: Date[] };
    expect(sql.values[0]).toEqual(now);
    expect(sql.values[1]).toEqual(new Date("2026-11-06T09:00:00Z"));
  });

  it("matches the dashboard card's six months by default", () => {
    const sql = dueWindow("overdue", "recent", now) as unknown as { values: Date[] };
    const since = new Date(now);
    since.setMonth(since.getMonth() - 6);
    expect(sql.values).toEqual([since, now]);
  });
});
