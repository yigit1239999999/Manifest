import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clinic: { findUnique: vi.fn() },
    diagnostic: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { unreadDiagnostics } from "./queries";

// "The result arrived" and "the vet read it" were one fact, and the
// gap between them is where a histopathology report sat in a file for
// three days while everybody did their job correctly.
describe("unreadDiagnostics", () => {
  const whereOf = () =>
    vi.mocked(prisma.diagnostic.findMany).mock.calls[0][0]?.where as Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.diagnostic.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.diagnostic.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({ timezone: "Europe/Istanbul" } as never);
  });

  it("counts yesterday's, not this morning's", async () => {
    // Counting today's would mean a number that is never zero during
    // working hours: a result typed at nine reads as unread at ten,
    // and a count that cannot be zero stops being looked at.
    await unreadDiagnostics("clinic-1", { now: new Date("2026-09-22T06:30:00.000Z") });

    // 09:30 in Istanbul, so the line is that morning's midnight there,
    // which is 21:00 UTC the day before.
    expect(whereOf().createdAt).toEqual({ lt: new Date("2026-09-21T21:00:00.000Z") });
  });

  it("uses the clinic's midnight, not the server's", async () => {
    // A clinic reading its dashboard at 09:00 means their yesterday.
    // UTC midnight would move the line three hours into their day.
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({ timezone: "America/New_York" } as never);

    await unreadDiagnostics("clinic-1", { now: new Date("2026-09-22T06:30:00.000Z") });

    // 02:30 in New York: still the 22nd there, so midnight of the 22nd
    // local, which is 04:00 UTC.
    expect(whereOf().createdAt).toEqual({ lt: new Date("2026-09-22T04:00:00.000Z") });
  });

  it("ignores rows with no answer in them yet", async () => {
    // A test with nothing recorded is not an unread result. Counting
    // it would make this a count of tests rather than of answers.
    await unreadDiagnostics("clinic-1");

    // `Prisma.DbNull` is how "the JSON column is not database-NULL" is
    // written; compared structurally rather than by value so the test
    // does not depend on its internal representation.
    const [byText, byData] = whereOf().OR as [Record<string, unknown>, Record<string, unknown>];
    expect(byText).toEqual({ result: { not: null } });
    expect(Object.keys(byData)).toEqual(["resultData"]);
    expect(whereOf().readAt).toBeNull();
  });

  // A result run in the room closes in the conversation that follows
  // it. Asking for a button there means finishing a finished job
  // several times a day, and within a week nobody presses it -- then
  // the unpressed rows pile up and nobody reads the list either.
  it("counts only what came from outside the clinic", async () => {
    await unreadDiagnostics("clinic-1");

    expect(whereOf().externalLab).toBe(true);
  });

  it("leaves out animals nobody is treating any more", async () => {
    await unreadDiagnostics("clinic-1");

    expect(whereOf().pet).toEqual({
      deceased: false,
      archivedAt: null,
      owner: { archivedAt: null },
    });
  });

  it("counts everything it found, not the rows it returned", async () => {
    // A badge that shrinks when the list is capped describes a
    // different set than the one under it.
    vi.mocked(prisma.diagnostic.count).mockResolvedValue(9 as never);
    vi.mocked(prisma.diagnostic.findMany).mockResolvedValue([{ id: "d-1" }] as never);

    const { items, total } = await unreadDiagnostics("clinic-1", { take: 1 });

    expect(items).toHaveLength(1);
    expect(total).toBe(9);
    expect(vi.mocked(prisma.diagnostic.count).mock.calls[0][0]?.where).toEqual(whereOf());
  });
});
