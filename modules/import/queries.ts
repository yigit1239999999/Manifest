import { prisma } from "@/lib/prisma";

/**
 * Below this many clients the dashboard offers the import. A clinic that
 * has typed in a handful by hand to try the product is exactly the clinic
 * that still has its real list somewhere else.
 */
export const IMPORT_PROMPT_BELOW = 20;

/** Whether the dashboard should offer the import card, given the client count it already has. */
export async function showImportPrompt(clinicId: string, clientCount: number): Promise<boolean> {
  if (clientCount >= IMPORT_PROMPT_BELOW) return false;
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { settings: true },
  });
  const settings = (clinic?.settings ?? {}) as { importPromptDismissedAt?: unknown };
  return !settings.importPromptDismissedAt;
}
