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

    expect(await blockedReminders("clinic-1")).toMatchObject({ items: [], total: 0 });
  });

  // The class this guards is narrower than "not blocked", and value
  // named it: `EXPIRED` looks like an obstacle and is not one. It is
  // unknowing -- the operator stopped telling us, which is not the
  // same as the message failing. Somebody reasoning "no report means
  // it never arrived" would add it to BLOCKED_STATES, the whole
  // EXPIRED distinction would collapse, and the only symptom would be
  // a number growing in production.
  it("keeps a closed retry window out of the count, and a held-back twin", async () => {
    const accepted = (deliveryStatus: string, status = "SENT") => [
      {
        status,
        createdAt: new Date("2026-09-20T06:00:00.000Z"),
        error: null,
        channel: "SMS",
        deliveryStatus,
      },
    ];
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-expired", messages: accepted("EXPIRED") }),
      // Suppressed is the same shape of mistake from the other side:
      // it says "not sent", which reads like an obstacle, but nothing
      // is stuck -- the owner got those words from its twin.
      reminder({ id: "r-twin", messages: accepted("UNKNOWN", "SUPPRESSED") }),
    ] as never);

    expect(await blockedReminders("clinic-1")).toMatchObject({ items: [], total: 0 });
  });

  // Two questions, one call, and the names are shared because a click
  // on the dashboard number filters the tab to exactly these rows.
  //
  // The test that separates the groups is whether the number can reach
  // zero this week: "tried and did not arrive" can, "nobody asked this
  // owner" cannot, and a number that cannot reach zero stops being
  // read.
  it("separates what was tried from what was never sent", async () => {
    const failedTimes = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        status: "FAILED",
        createdAt: new Date(`2026-09-1${i + 1}T08:00:00.000Z`),
        error: "message_too_long_or_invalid",
        channel: "SMS",
      }));
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-undelivered", messages: [
        { status: "SENT", createdAt: new Date("2026-09-20T06:00:00.000Z"), error: null, channel: "SMS", deliveryStatus: "UNDELIVERED" },
      ] }),
      reminder({ id: "r-exhausted", messages: failedTimes(3) }),
      // The sweep will try this one again tonight: not this morning's
      // work, and not in either group.
      reminder({ id: "r-retrying", messages: failedTimes(1) }),
      reminder({ id: "r-unasked", client: { ...reminder().client, notificationsOptIn: null } }),
    ] as never);

    const { items, total, unreachedTotal, blockedTotal } = await blockedReminders("clinic-1");

    expect(items.map((i) => [i.id, i.reason, i.group])).toEqual([
      ["r-undelivered", "undelivered", "unreached"],
      ["r-exhausted", "failedExhausted", "unreached"],
      ["r-unasked", "neverAsked", "blocked"],
    ]);
    expect([total, unreachedTotal, blockedTotal]).toEqual([3, 2, 1]);
  });

  // Exhaustion is the sweep's own count: a failure we caused does not
  // spend an attempt, so three duplicate blocks are not "given up on".
  it("does not call a reminder exhausted on failures of our own making", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({
        id: "r-ours",
        messages: Array.from({ length: 3 }, (_, i) => ({
          status: "FAILED",
          createdAt: new Date(`2026-09-1${i + 1}T08:00:00.000Z`),
          error: "duplicate_send_blocked",
          channel: "SMS",
        })),
      }),
    ] as never);

    expect((await blockedReminders("clinic-1")).unreachedTotal).toBe(0);
  });

  // Never set up is not switched off. One is an invitation, the other
  // is a reminder of the clinic's own decision -- and a clinic that
  // has never opened the settings page was being told it had decided.
  it("tells a clinic that never set this up from one that switched it off", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([reminder()] as never);

    vi.mocked(getClinicMessagingProfile).mockResolvedValue(clinic({}));
    expect((await blockedReminders("clinic-1")).byReason.notSetUp).toBe(1);

    vi.mocked(getClinicMessagingProfile).mockResolvedValue(
      clinic({ notifications: { channel: "SMS", whatsapp: { enabled: false } } }),
    );
    expect((await blockedReminders("clinic-1")).byReason.disabled).toBe(1);
  });

  // The settings screen needs one reason on its own, and it has to
  // come from here: a count of its own beside the switch would
  // eventually disagree with the one on the dashboard.
  it("breaks the count down by reason, over everything and not the capped rows", async () => {
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([
      reminder({ id: "r-1", client: { ...reminder().client, notificationsOptIn: null } }),
      reminder({ id: "r-2", client: { ...reminder().client, notificationsOptIn: null } }),
      reminder({ id: "r-3", client: { ...reminder().client, notificationsOptIn: false } }),
    ] as never);

    const { byReason } = await blockedReminders("clinic-1", { take: 1 });

    // Two never asked, one refused -- and the refusal is not counted
    // as a gap: it is a decision the owner made.
    expect(byReason.neverAsked).toBe(2);
    expect(byReason.optedOut).toBe(1);
    expect(byReason.noPhone).toBe(0);
  });

  it("leaves out a reminder whose owner has been archived", async () => {
    // The sweep's candidate query excludes them, and a tab listing
    // them would send a vet to tidy a record for somebody the clinic
    // no longer sees.
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([] as never);

    await blockedReminders("clinic-1");

    const where = vi.mocked(prisma.reminder.findMany).mock.calls[0][0]
      ?.where as { client?: unknown };
    expect(where.client).toEqual({ archivedAt: null });
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
