import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reminder: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    messageLog: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  listReminders,
  OPEN_REMINDER_STATUSES,
  reminderStatusCounts,
} from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.reminder.count).mockResolvedValue(0 as never);
});

const callOf = () => vi.mocked(prisma.reminder.findMany).mock.calls[0][0];

// The fold can say "this did not go, the same words did" from the
// suppressed row alone. Which piece of work sent them is the thing a
// vet looking at two reminders for one animal actually wants, and it
// is not on that row.
describe("naming the message that went instead", () => {
  const suppressedAt = new Date("2026-09-21T12:00:00.000Z");
  const suppressed = (recipient: string, body: string) => ({
    id: "r-2",
    messages: [{ status: "SUPPRESSED", recipient, body, createdAt: suppressedAt }],
  });

  beforeEach(() => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      suppressed("905321234567", "Sayın Ayşe, Sarı için aşı zamanı."),
    ] as never);
  });

  it("names it when exactly one message carries those words", async () => {
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([
      {
        recipient: "905321234567",
        body: "Sayın Ayşe, Sarı için aşı zamanı.",
        createdAt: new Date("2026-09-21T11:00:00.000Z"),
        reminder: { id: "r-1", title: "Kuduz aşısı" },
      },
    ] as never);

    const {
      items: [row],
    } = await listReminders({ clinicId: "clinic-1" });

    expect(row.messages[0].sentInstead).toEqual({ id: "r-1", title: "Kuduz aşısı" });
  });

  // The objection this answers: with three reminders composing one
  // text, which one went? The dedupe permits exactly one, so normally
  // there is one accepted message and it knows its own reminder. Where
  // that does not hold -- history from before the dedupe -- there is
  // no single answer, and saying the nearest thing would be the kind
  // of plausible-but-sometimes-wrong sentence this release spent the
  // day deleting.
  it("says nothing when two messages carry them, rather than picking one", async () => {
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([
      {
        recipient: "905321234567",
        body: "Sayın Ayşe, Sarı için aşı zamanı.",
        createdAt: new Date("2026-09-21T11:00:00.000Z"),
        reminder: { id: "r-1", title: "Kuduz aşısı" },
      },
      {
        recipient: "905321234567",
        body: "Sayın Ayşe, Sarı için aşı zamanı.",
        createdAt: new Date("2026-09-21T11:30:00.000Z"),
        reminder: { id: "r-3", title: "Karma aşı" },
      },
    ] as never);

    const {
      items: [row],
    } = await listReminders({ clinicId: "clinic-1" });

    expect(row.messages[0].sentInstead).toBeNull();
  });

  // A vaccination reminder is annual, and the text is the owner, the
  // animal, the type and the day -- so next year composes the same
  // words. Unbounded, the match would find both, call it ambiguous,
  // and fall silent for good: the feature would switch itself off and
  // nothing would say why. The window is the dedupe's own, because
  // the guarantee that makes this a fact has a duration as well as a
  // shape.
  it("is not confused by the same words sent a year ago", async () => {
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([
      {
        recipient: "905321234567",
        body: "Sayın Ayşe, Sarı için aşı zamanı.",
        createdAt: new Date("2026-09-21T11:00:00.000Z"),
        reminder: { id: "r-1", title: "Kuduz aşısı" },
      },
    ] as never);

    const {
      items: [row],
    } = await listReminders({ clinicId: "clinic-1" });

    // The old one never reaches the ambiguity check, because the query
    // does not ask for it.
    const where = vi.mocked(prisma.messageLog.findMany).mock.calls[0][0]
      ?.where as { createdAt?: { gte?: Date } };
    expect(where.createdAt?.gte).toEqual(new Date("2026-09-20T12:00:00.000Z"));
    expect(row.messages[0].sentInstead).toEqual({ id: "r-1", title: "Kuduz aşısı" });
  });

  // A message is only ever held back BECAUSE another had already
  // gone, so its partner cannot be newer than it is. Without a
  // direction the row would say "the same message had already gone
  // out" while pointing at one sent an hour later -- which is what pm
  // found in the fixture data.
  it("does not accept a partner that went out afterwards", async () => {
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([
      {
        recipient: "905321234567",
        body: "Sayın Ayşe, Sarı için aşı zamanı.",
        createdAt: new Date("2026-09-21T13:00:00.000Z"),
        reminder: { id: "r-later", title: "Karma aşı" },
      },
    ] as never);

    const {
      items: [row],
    } = await listReminders({ clinicId: "clinic-1" });

    expect(row.messages[0].sentInstead).toBeNull();
    // The coarse bound is in the query too, so most of them never
    // come back at all.
    const where = vi.mocked(prisma.messageLog.findMany).mock.calls[0][0]
      ?.where as { createdAt?: { lte?: Date } };
    expect(where.createdAt?.lte).toEqual(suppressedAt);
  });

  it("says nothing when the partner is gone", async () => {
    vi.mocked(prisma.messageLog.findMany).mockResolvedValue([] as never);

    const {
      items: [row],
    } = await listReminders({ clinicId: "clinic-1" });

    expect(row.messages[0].sentInstead).toBeNull();
  });

  // One extra query for the page, and only when something was
  // suppressed -- not a lookup per row.
  it("asks nothing extra when nothing was held back", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      {
        id: "r-1",
        messages: [
          { status: "SENT", recipient: "9053", body: "x", createdAt: suppressedAt },
        ],
      },
    ] as never);

    await listReminders({ clinicId: "clinic-1" });

    expect(prisma.messageLog.findMany).not.toHaveBeenCalled();
  });
});

describe("listReminders", () => {
  it("carries the owner's phone number on the row", async () => {
    // The row is a piece of work and the work is usually a call. Dropping
    // this field again would not break anything visibly — the Call action
    // would simply stop having a number — so the reason it is selected is
    // written here rather than left to be rediscovered.
    await listReminders({ clinicId: "clinic-1" });

    const include = callOf()?.include as
      | { client?: { select?: Record<string, unknown> } }
      | undefined;
    expect(include?.client?.select).toMatchObject({ phone: true });
  });

  it("carries what was written and where it went, for the fold", async () => {
    // Read from `MessageLog`, never from `Reminder.status`: the status
    // is the vet's decision about the work, these rows are what the
    // provider was actually handed. The fold shows the message text and
    // the number it went to, which is the only place either appears.
    await listReminders({ clinicId: "clinic-1" });

    const include = callOf()?.include as
      | { messages?: { where?: unknown; select?: Record<string, unknown> } }
      | undefined;
    expect(include?.messages?.where).toEqual({ kind: "REMINDER_DUE" });
    expect(include?.messages?.select).toMatchObject({
      status: true,
      createdAt: true,
      error: true,
      channel: true,
      body: true,
      recipient: true,
    });
  });

  it("shows the statuses that still count as work, oldest due first", async () => {
    // `SENT` belongs here: a reminder that went out has not closed, the
    // animal has not come back. The dashboard card reads the same constant,
    // which is what stopped the card and the list disagreeing.
    await listReminders({ clinicId: "clinic-1" });

    expect(callOf()).toMatchObject({
      where: { clinicId: "clinic-1", status: { in: [...OPEN_REMINDER_STATUSES] } },
      orderBy: { dueAt: "asc" },
    });
  });

  it("pages instead of cutting the list off, and says how many there are", async () => {
    // It used to be `take: 100` and nothing else: the 101st reminder was
    // not on screen and nothing said it existed (backlog 38). The total is
    // counted over the same filter as the rows, so the pager and the list
    // describe the same set.
    vi.mocked(prisma.reminder.count).mockResolvedValue(140 as never);

    const result = await listReminders({ clinicId: "clinic-1", page: 2 });

    expect(callOf()).toMatchObject({ skip: 100, take: 100 });
    expect(vi.mocked(prisma.reminder.count).mock.calls[0][0]).toEqual({
      where: callOf()?.where,
    });
    expect(result).toMatchObject({ total: 140, page: 2, perPage: 100 });
  });
});

describe("reminderStatusCounts", () => {
  it("splits the clinic's reminders into the list's open and closed tabs", async () => {
    vi.mocked(prisma.reminder.groupBy).mockResolvedValue([
      { status: "PENDING", _count: { _all: 3 } },
      { status: "SENT", _count: { _all: 4 } },
      { status: "ACKNOWLEDGED", _count: { _all: 80 } },
      { status: "DISMISSED", _count: { _all: 4 } },
    ] as never);

    const counts = await reminderStatusCounts("clinic-1");

    // SENT is open work, as on the dashboard card: 3 + 4, not 3.
    expect(counts).toEqual({ open: 7, closed: 84, all: 91 });
    expect(
      vi.mocked(prisma.reminder.groupBy).mock.calls[0][0],
    ).toMatchObject({ where: { clinicId: "clinic-1" } });
  });
});
