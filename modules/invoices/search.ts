import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";

/**
 * Invoices whose number contains what was typed, for the command palette
 * (pm C4: a number read out over the phone had no way in but the list).
 *
 * From three characters: a two-letter name fragment would match half the
 * numbers in a clinic whose numbers carry a prefix.
 */
export async function quickSearchInvoices(
  clinicId: string,
  term: string,
  take: number = PAGE_SIZES.COMMAND_PALETTE,
) {
  const text = term.trim();
  if (text.length < 3) return [];
  return prisma.invoice.findMany({
    where: {
      clinicId,
      number: { contains: text, mode: "insensitive" },
      client: { archivedAt: null },
    },
    orderBy: { issuedAt: "desc" },
    take,
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      currency: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
}
