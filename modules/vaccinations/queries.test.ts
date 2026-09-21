import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { vaccination: { findMany: vi.fn(), count: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { intervalOf } from "@/lib/vaccination-interval";
import {
  countOverdueVaccinations,
  overdueVaccinations,
  upcomingVaccinations,
  vaccinationIntervalSuggestions,
} from "./queries";

// Backlog 20. The suggestion behind the next-due field is the one place the
// app comes closest to making a medical claim, so the rules about when it
// stays quiet matter more than the arithmetic (TEAM.md #14): a wrong
// interval schedules a wrong reminder and nobody ever finds out.

const DAY = 86_400_000;

function record(name: string, gapDays: number, index = 0) {
  const administeredAt = new Date(2026, 0, 1 + index);
  return {
    name,
    administeredAt,
    nextDueAt: new Date(administeredAt.getTime() + gapDays * DAY),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

const suggest = async (rows: unknown[]) => {
  vi.mocked(prisma.vaccination.findMany).mockResolvedValue(rows as never);
  return vaccinationIntervalSuggestions("clinic-1", "DOG");
};

// The card is where sending starts. A vet reads it, writes a reminder,
// and only the far end of the chain catches a dead animal -- the sweep
// refuses and the row says why. Nothing catches a vet who picks up the
// phone instead, which is the worse of the two.
describe("upcomingVaccinations", () => {
  it("never offers work for an animal that died or was archived", async () => {
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([] as never);

    await upcomingVaccinations("clinic-1");

    const where = vi.mocked(prisma.vaccination.findMany).mock.calls[0][0]
      ?.where as Record<string, unknown>;
    // In the query, for the same reason the sweep keeps it in its own:
    // a filter applied after the read is one a later caller can skip.
    // Both layers, because the dashboard's own counts query has both:
    // an archived owner is one the clinic no longer serves, and that
    // does not archive their animal.
    expect(where.pet).toEqual({
      deceased: false,
      archivedAt: null,
      owner: { archivedAt: null },
    });
    expect(where.clinicId).toBe("clinic-1");
  });
});

// A backlog, not a longer plan. "Upcoming" sorts by soonest and says
// what is coming; this sorts by longest overdue, and the animal that
// has waited longest is the one most likely already lost.
describe("overdueVaccinations", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  const whereOf = () =>
    vi.mocked(prisma.vaccination.findMany).mock.calls[0][0]?.where as Record<string, unknown>;

  beforeEach(() => {
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([] as never);
  });

  it("looks back six months and no further, ending at now", async () => {
    await overdueVaccinations("clinic-1", 5, now);

    expect(whereOf().nextDueAt).toEqual({
      gte: new Date("2026-03-21T12:00:00.000Z"),
      lt: now,
    });
  });

  it("leaves out rows somebody has closed, and dead or archived animals", async () => {
    await overdueVaccinations("clinic-1", 5, now);

    expect(whereOf().dueDismissedAt).toBeNull();
    // The same two layers as the upcoming card: an overdue booster for
    // a dead animal is the worst version of this card, not a milder
    // one -- it sorts to the top.
    expect(whereOf().pet).toEqual({
      deceased: false,
      archivedAt: null,
      owner: { archivedAt: null },
    });
  });

  it("puts the longest overdue first", async () => {
    await overdueVaccinations("clinic-1", 5, now);

    expect(vi.mocked(prisma.vaccination.findMany).mock.calls[0][0]?.orderBy).toEqual({
      nextDueAt: "asc",
    });
  });
});

describe("countOverdueVaccinations", () => {
  it("counts exactly what the list shows, so the heading cannot disagree", async () => {
    // The card shows five rows and says how many there are. If the two
    // came from different conditions, "5 of 40" could be drawn over a
    // list that is not part of the 40.
    const now = new Date("2026-09-21T12:00:00.000Z");
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.vaccination.count).mockResolvedValue(0 as never);

    await overdueVaccinations("clinic-1", 5, now);
    await countOverdueVaccinations("clinic-1", now);

    expect(vi.mocked(prisma.vaccination.count).mock.calls[0][0]?.where).toEqual(
      vi.mocked(prisma.vaccination.findMany).mock.calls[0][0]?.where,
    );
  });
});

describe("intervalOf", () => {
  it("speaks in the unit a vet would say out loud", () => {
    expect(intervalOf(365)).toEqual({ unit: "year", value: 1 });
    expect(intervalOf(364)).toEqual({ unit: "year", value: 1 });
    expect(intervalOf(91)).toEqual({ unit: "month", value: 3 });
    expect(intervalOf(21)).toEqual({ unit: "week", value: 3 });
  });

  it("says nothing about a gap too small to be a schedule", () => {
    expect(intervalOf(1)).toBeNull();
    expect(intervalOf(0)).toBeNull();
  });
});

describe("vaccinationIntervalSuggestions", () => {
  it("offers the interval this clinic keeps repeating", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => record("Kuduz", 365, i));

    const result = await suggest(rows);

    expect(result["kuduz"]).toEqual({ unit: "year", value: 1, sampleSize: 4 });
  });

  it("stays quiet below three records, where there is no 'usually' yet", async () => {
    const result = await suggest([record("Kuduz", 365, 0), record("Kuduz", 365, 1)]);

    expect(result).toEqual({});
  });

  it("stays quiet when the clinic has no habit to report", async () => {
    // Four records, four different answers: the most common one is common
    // by accident. Offering it would be the app inventing a schedule.
    const result = await suggest([
      record("Karma", 365, 0),
      record("Karma", 180, 1),
      record("Karma", 90, 2),
      record("Karma", 30, 3),
    ]);

    expect(result).toEqual({});
  });

  it("holds a majority against a stray entry", async () => {
    const result = await suggest([
      record("Kuduz", 365, 0),
      record("Kuduz", 365, 1),
      record("Kuduz", 365, 2),
      record("Kuduz", 30, 3),
    ]);

    expect(result["kuduz"]).toMatchObject({ unit: "year", value: 1 });
    expect(result["kuduz"].sampleSize).toBe(4);
  });

  it("treats the same vaccine typed differently as one vaccine", async () => {
    const result = await suggest([
      record("Kuduz", 365, 0),
      record("kuduz ", 365, 1),
      record("KUDUZ", 365, 2),
    ]);

    expect(Object.keys(result)).toEqual(["kuduz"]);
  });

  it("only looks at this clinic, this species, and records with a date", async () => {
    await suggest([]);

    expect(prisma.vaccination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinicId: "clinic-1",
          nextDueAt: { not: null },
          pet: { species: "DOG", archivedAt: null },
        },
      }),
    );
  });
});
