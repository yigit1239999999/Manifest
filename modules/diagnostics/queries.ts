import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { zonedParts, zonedTimeToUtc } from "@/lib/whatsapp/schedule";

export async function listDiagnosticsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.diagnostic.findMany({
    where: { clinicId, petId },
    orderBy: { performedAt: "desc" },
    take,
  });
}

/**
 * Results nobody has read, from before today.
 *
 * "The result arrived" and "the vet read it" were the same fact until
 * `readAt` existed, and the gap between them is where a
 * histopathology report sat in a file for three days.
 *
 * Only results entered on an earlier day. Counting today's would mean
 * a number that never reaches zero during working hours -- a result
 * typed in at nine would read as unread at ten, and a count that is
 * never zero stops being looked at. The day is not an invented
 * threshold either: it is the vet's own working boundary, good news
 * goes out the same day and bad news waits for the morning, and the
 * morning is when the dashboard is read.
 *
 * The boundary is midnight in the CLINIC's timezone, not the server's.
 * A clinic in Istanbul reading a dashboard at 09:00 means their
 * yesterday, and UTC midnight would move the line three hours into
 * their working day.
 *
 * Entered, not performed: `createdAt` is when the clinic learned the
 * answer, which is the thing that can go unseen. An external lab's
 * report is typed in days after the sample was taken, and dating this
 * by `performedAt` would make it overdue on arrival.
 */
export async function unreadDiagnostics(
  clinicId: string,
  { now = new Date(), take = PAGE_SIZES.LIST }: { now?: Date; take?: number } = {},
) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { timezone: true },
  });
  const parts = zonedParts(now, clinic?.timezone || "UTC");
  const startOfToday = zonedTimeToUtc({ ...parts, hour: 0, minute: 0 }, clinic?.timezone || "UTC");

  const where = {
    clinicId,
    readAt: null,
    createdAt: { lt: startOfToday },
    // A row with nothing in it yet is not an unread result: there is
    // nothing to read. Today a diagnostic is created when its answer
    // is recorded, but that will not always be true, and a count that
    // includes empty ones would be counting tests rather than results.
    OR: [{ result: { not: null } }, { resultData: { not: Prisma.DbNull } }],
    // The same rule as everywhere else: an animal that died or was
    // archived is not work, and neither is one whose owner left.
    pet: { deceased: false, archivedAt: null, owner: { archivedAt: null } },
  } satisfies Prisma.DiagnosticWhereInput;

  const [items, total] = await Promise.all([
    prisma.diagnostic.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take,
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        pet: { select: { id: true, name: true } },
      },
    }),
    // Counted separately rather than from the rows, so the number
    // stays true when the list is cut.
    prisma.diagnostic.count({ where }),
  ]);
  return { items, total };
}
