import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { reminder: { findMany: vi.fn(), count: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { listReminders, OPEN_REMINDER_STATUSES } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);
});

const callOf = () => vi.mocked(prisma.reminder.findMany).mock.calls[0][0];

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
});
