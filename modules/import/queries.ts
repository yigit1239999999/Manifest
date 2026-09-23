import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";

/**
 * The clinic's recent imports, newest first.
 *
 * Exists so that undo survives the screen. A vet who imports a file, closes
 * the tab and opens the client list at noon has no way back to the result
 * page; without this list, "undo" would only be reachable in the minute
 * after the button, which is not when regret arrives.
 *
 * The counts are columns rather than a count per batch: one query for the
 * whole list, and the numbers still read correctly after the rows they
 * describe have been deleted by the undo.
 */
export async function listImportBatches(clinicId: string, take = PAGE_SIZES.DEFAULT) {
  return prisma.importBatch.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      fileName: true,
      clientCount: true,
      petCount: true,
      mergedCount: true,
      undoneAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}
