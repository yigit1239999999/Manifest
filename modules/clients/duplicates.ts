import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The digits a phone is compared by, the same rule as the generated
 * `Client.phoneDigits`: digits only, the last ten when there are ten or
 * more. Null below seven digits -- too short to say two people share it.
 */
export function comparableDigits(raw: string | null | undefined): string | null {
  const text = raw?.trim() ?? "";
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  const last = digits.length >= 10 ? digits.slice(-10) : digits;
  return last.length >= 7 ? last : null;
}

export interface DuplicateCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  archivedAt: Date | null;
  /** Which of the typed values it shares. */
  matchedOn: ("phone" | "email")[];
  pets: { name: string }[];
}

/**
 * Clients already on file with this phone (either of theirs) or this
 * e-mail, in this clinic.
 *
 * pm B6: the same owner was opened twice at the counter because nothing
 * said the number was already somebody's, and the second record split
 * the animal's history in two. Archived clients are included and say so:
 * restoring the old record is the answer then, not a third one.
 *
 * `phoneDigits` holds "phone secondary" with a space between, so a match
 * is the whole value, its first half or its second half -- never a run of
 * digits spanning both.
 */
export async function findDuplicateClients(
  clinicId: string,
  input: { phone?: string | null; email?: string | null; excludeId?: string | null },
  take = 3,
): Promise<DuplicateCandidate[]> {
  const digits = comparableDigits(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const or: Prisma.ClientWhereInput[] = [];
  if (digits) {
    or.push(
      { phoneDigits: digits },
      { phoneDigits: { startsWith: `${digits} ` } },
      { phoneDigits: { endsWith: ` ${digits}` } },
    );
  }
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (or.length === 0) return [];

  const rows = await prisma.client.findMany({
    where: {
      clinicId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: or,
    },
    // The record somebody is still working with first.
    orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { createdAt: "asc" }],
    take,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      phoneDigits: true,
      archivedAt: true,
      pets: {
        where: { archivedAt: null },
        select: { name: true },
        orderBy: { name: "asc" },
        take: 3,
      },
    },
  });

  return rows.map(({ phoneDigits, ...row }) => {
    const matchedOn: ("phone" | "email")[] = [];
    if (digits && (phoneDigits ?? "").split(" ").includes(digits)) matchedOn.push("phone");
    if (email && row.email?.toLowerCase() === email) matchedOn.push("email");
    return { ...row, matchedOn };
  });
}
