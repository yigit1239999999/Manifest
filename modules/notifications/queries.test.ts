import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { reminder: { findMany: vi.fn() }, messageLog: { findMany: vi.fn() } },
}));
vi.mock("./settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./settings")>()),
  getClinicMessagingProfile: vi.fn(),
}));
vi.mock("@/lib/messaging/transports", () => ({
  getTransport: vi.fn(),
  isChannelConfigured: vi.fn(() => true),
  transportName: vi.fn(() => "netgsm"),
  transportReportsDelivery: vi.fn(() => true),
}));

import { prisma } from "@/lib/prisma";
import { blockedReminders } from "./queries";
import { getClinicMessagingProfile, toMessagingProfile } from "./settings";

const clinic = (settings: unknown) =>
  toMessagingProfile({
    id: "clinic-1",
    name: "Klinik",
    phone: null,
    address: null,
    city: null,
    country: "TR",
    timezone: "Europe/Istanbul",
    settings,
  });

const on = { notifications: { channel: "SMS", whatsapp: { enabled: true } } };

function reminder(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    title: "Kuduz aşısı",
    dueAt: new Date("2026-09-22T09:00:00.000Z"),
    status: "PENDING",
    client: {
      id: "c-1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      phone: "0532 123 45 67",
      notificationsOptIn: true,
    },
    pet: { id: "p-1", name: "Sarı", deceased: false, archivedAt: null },
    messages: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClinicMessagingProfile).mockResolvedValue(clinic(on));
});

// One function, because two screens ask the same question: the
// dashboard wants the number and the list's tab wants the rows.
// Written twice they disagree eventually, and then nobody can say
// which is right.
describe("blockedReminders", () => {
  it("names each obstacle with the same words the row uses", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-declined", client: { ...reminder().client, notificationsOptIn: false } }),
      reminder({ id: "r-unasked", client: { ...reminder().client, notificationsOptIn: null } }),
      reminder({ id: "r-nophone", client: { ...reminder().client, phone: null } }),
      reminder({ id: "r-dead", pet: { ...reminder().pet, deceased: true } }),
    ] as never);

    const { items, total } = await blockedReminders("clinic-1");

    expect(total).toBe(4);
    expect(items.map((i) => [i.id, i.reason])).toEqual([
      ["r-declined", "optedOut"],
      ["r-unasked", "neverAsked"],
      ["r-nophone", "noPhone"],
      ["r-dead", "petSilenced"],
    ]);
  });

  // "What is stuck" is a different question from "what went wrong".
  // A reminder that is simply waiting its turn is not an obstacle,
  // and neither is one whose message already went.
  // Four of the six reasons end in a phone call, so a list that shows
  // the problem and sends the vet elsewhere to act on it is a list
  // read once. Raw: whether it can be dialled is the screen's
  // question, and `telHref` is where that rule lives.
  it("carries the number, including the one that cannot be dialled", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-declined", client: { ...reminder().client, notificationsOptIn: false } }),
      reminder({ id: "r-nophone", client: { ...reminder().client, phone: null } }),
    ] as never);

    const { items } = await blockedReminders("clinic-1");

    expect(items.map((i) => i.client.phone)).toEqual(["0532 123 45 67", null]);
  });

  it("leaves out what is merely waiting, and what already happened", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-fine" }),
      reminder({
        id: "r-sent",
        messages: [
          {
            status: "SENT",
            createdAt: new Date("2026-09-20T06:00:00.000Z"),
            error: null,
            channel: "SMS",
          },
        ],
      }),
    ] as never);

    expect(await blockedReminders("clinic-1")).toEqual({ items: [], total: 0 });
  });

  it("asks only for the days the sweep can act on", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);

    await blockedReminders("clinic-1", { now: new Date("2026-09-20T12:00:00.000Z") });

    // The sweep's own window (`reminderNoticeWindow`): a day back, and
    // the clinic's lead time plus two ahead. A count over all time
    // would report work that is not work yet.
    const where = vi.mocked(prisma.reminder.findMany).mock.calls[0][0]
      ?.where as { dueAt?: { gte?: Date; lte?: Date }; status?: string };
    expect(where.status).toBe("PENDING");
    expect(where.dueAt?.gte).toEqual(new Date("2026-09-19T12:00:00.000Z"));
    expect(where.dueAt?.lte).toEqual(new Date("2026-09-25T12:00:00.000Z"));
  });

  // The number has to stay true when the list is cut, or the tab and
  // the badge start describing different sets.
  it("caps the rows and not the count", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) =>
        reminder({ id: `r-${i}`, client: { ...reminder().client, notificationsOptIn: false } }),
      ) as never,
    );

    const { items, total } = await blockedReminders("clinic-1", { take: 2 });

    expect(items).toHaveLength(2);
    expect(total).toBe(5);
  });
});
