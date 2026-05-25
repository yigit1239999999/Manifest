// Audit trail. Every meaningful mutation writes one row.
//
// Failures are logged but never bubble up — losing an audit row must not
// break the user's action. If you need stronger guarantees later, write
// the audit row inside the same Prisma `$transaction` as the mutation.

import { AuditAction } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { logger } from "./logger";

export { AuditAction };

export interface AuditEntry {
  clinicId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clinicId: entry.clinicId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (entry.changes ?? undefined) as never,
        metadata: (entry.metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", {
      err: error instanceof Error ? error.message : String(error),
      entry,
    });
  }
}
