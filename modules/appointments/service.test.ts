import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    appointment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    pet: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

const notifyAppointmentBooked = vi.fn();
vi.mock("@/modules/notifications/service", () => ({
  notifyAppointmentBooked: (...args: unknown[]) =>
    notifyAppointmentBooked(...args),
}));

import { prisma } from "@/lib/prisma";
import { createAppointment } from "./service";

const ctx = {
  clinicId: "clinic-1",
  userId: "user-1",
  userName: "Test",
  userRole: "ADMIN",
};

const startsAt = new Date("2026-09-25T07:30:00.000Z");

const validInput = {
  petId: "pet-1",
  vetId: null,
  startsAt,
  durationMinutes: 30,
  type: "WELLNESS_CHECK" as const,
  status: "SCHEDULED" as const,
  reason: null,
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  vi.mocked(prisma.pet.findFirst).mockResolvedValue({
    id: "pet-1",
    ownerId: "owner-1",
  } as never);
});

// Reproduced three times out of three against a slow route: the staff member
// submits again and the clinic has two identical appointments. What made it
// worth a rule rather than a fix for that one cause is that the causes cannot
// be listed — a double click, a refreshed tab, a dropped connection and a
// restarted server all arrive the same way.
describe("createAppointment, asked twice for the same slot", () => {
  it("returns the appointment that already exists", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
      petId: "pet-1",
    } as never);

    const { appointment, created } = await createAppointment(validInput, ctx);

    expect(appointment).toMatchObject({ id: "a-1" });
    expect(created).toBe(false);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("does not send the owner a second confirmation", async () => {
    // The row is the smaller half of the harm. The owner getting the same
    // "your appointment is booked" twice is the release's whole promise,
    // broken by the app itself.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
    } as never);

    await createAppointment(validInput, ctx);

    expect(notifyAppointmentBooked).not.toHaveBeenCalled();
  });

  it("writes no second audit entry either", async () => {
    // A CREATE in the trail that created nothing would make the history
    // disagree with the records it is a history of.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-1",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("looks for the clash on clinic, animal and instant, ignoring cancelled", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: {
        clinicId: "clinic-1",
        petId: "pet-1",
        startsAt,
        status: { not: "CANCELLED" },
      },
    });
  });

  it("still books when the only appointment at that instant was cancelled", async () => {
    // The one case where a second booking is real: the owner cancelled and
    // rang back. `findFirst` excludes cancelled rows, so it finds nothing
    // and the booking goes through — refusing it would be the app inventing
    // a rule the clinic does not have.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    const { appointment, created } = await createAppointment(validInput, ctx);

    expect(appointment).toMatchObject({ id: "a-2" });
    expect(created).toBe(true);
    expect(notifyAppointmentBooked).toHaveBeenCalledWith("a-2", ctx);
  });

  it("reads and writes in one serializable transaction", async () => {
    // Read-then-write is the exact shape two overlapping submits defeat:
    // without this both read "none" and both insert.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "a-2",
    } as never);

    await createAppointment(validInput, ctx);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  // The database holds the same rule as a partial unique index, for the
  // case the read cannot see: two requests on separate connections. The
  // index is the second belt, and these say what the loser of that race is
  // shown — which must not be a database error. Being told
  // "Unique constraint failed on the fields: (clinicId, petId, startsAt)"
  // is worse than the duplicate it prevented.
  it.each([
    ["the unique index refused it", "P2002"],
    ["the transaction could not be ordered", "P2034"],
  ])("returns the winner's appointment when %s", async (_case, code) => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("write conflict"), { code }),
    );
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: "a-first",
    } as never);

    const { appointment } = await createAppointment(validInput, ctx);

    expect(appointment).toMatchObject({ id: "a-first" });
    expect(notifyAppointmentBooked).not.toHaveBeenCalled();
  });

  it("does not swallow a failure that is not that race", async () => {
    // Everything else still has to reach the caller. A `catch` that turns
    // every error into "it already exists" would hide the next real one.
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("connection lost"), { code: "P1001" }),
    );

    await expect(createAppointment(validInput, ctx)).rejects.toThrow(
      "connection lost",
    );
  });

  it("re-throws the race error when nothing turns up on the second look", async () => {
    // Losing the race means someone else's row is there. If it is not, the
    // cause was something we have not understood and reporting success
    // would be a lie.
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("write conflict"), { code: "P2002" }),
    );
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

    await expect(createAppointment(validInput, ctx)).rejects.toThrow(
      "write conflict",
    );
  });

  // The tail the duplicate guard grew, found in acceptance: the second
  // submission's "Reason" was thrown away and the page it landed on showed
  // the first appointment's empty one. Preventing a duplicate row by
  // silently eating what someone typed is a worse fault than the duplicate.
  //
  // The text is still not written to the stored record, and that is the
  // decision rather than an omission: someone else may have made the first
  // appointment, and overwriting their reason with this submission's would
  // trade a duplicate row for a lost one. What changes is that the screen
  // is told, so `discarded` says whether there is anything to tell.
  const stored = {
    id: "a-1",
    vetId: null,
    durationMinutes: 30,
    type: "WELLNESS_CHECK",
    status: "SCHEDULED",
    reason: null,
    notes: null,
  };

  it("reports that the details typed the second time were not kept", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(stored as never);

    const { discarded } = await createAppointment(
      { ...validInput, reason: "Aşı tekrarı" },
      ctx,
    );

    expect(discarded).toBe(true);
  });

  it("says nothing was lost when the second submission matched", async () => {
    // Two identical submits — a double click — lose nothing, and telling
    // the user their details were dropped would be its own small lie.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(stored as never);

    const { discarded } = await createAppointment(validInput, ctx);

    expect(discarded).toBe(false);
  });

  it("treats empty text and no text as the same submission", async () => {
    // A form posts "" for an untouched field; the column holds null. They
    // are the same thing, and reading them as different would report a
    // loss on every duplicate.
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(stored as never);

    const { discarded } = await createAppointment(
      { ...validInput, reason: "   ", notes: "" },
      ctx,
    );

    expect(discarded).toBe(false);
  });

  it("never reports a loss for an appointment it actually created", async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: "a-2" } as never);

    const { discarded } = await createAppointment(
      { ...validInput, reason: "Aşı tekrarı" },
      ctx,
    );

    expect(discarded).toBe(false);
  });

  // Same rule as a visit's vet, same reason one level along: an
  // appointment's vet is who is expected to see the animal, so a
  // receptionist saved there sends the day's plan to the wrong person.
  it("refuses a vet the clinic does not recognise", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(
      createAppointment({ ...validInput, vetId: "reception-1" }, ctx),
    ).rejects.toMatchObject({
      details: { fieldErrors: { vetId: ["error.validation.vetRequired"] } },
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("records one it does", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "vet-1" } as never);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: "a-2" } as never);

    await createAppointment({ ...validInput, vetId: "vet-1" }, ctx);

    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vetId: "vet-1" }),
    });
  });
});
