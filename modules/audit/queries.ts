import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";

export interface ListAuditArgs {
  clinicId: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  take?: number;
}

export async function listAuditEntries({
  clinicId,
  entityType,
  entityId,
  actorId,
  take = PAGE_SIZES.LIST,
}: ListAuditArgs) {
  return prisma.auditLog.findMany({
    where: {
      clinicId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actorId ? { actorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { id: true, name: true } } },
  });
}
