// Audit trail. Every meaningful mutation writes one row.
//
// `writeAudit` accepts an optional Prisma transaction client. Inside a
// transaction the audit insert MUST succeed (so the user's mutation
// rolls back if it fails); outside a transaction we keep the original
// best-effort behaviour because losing one audit row should never
// break the user's action.

import { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

export { AuditAction };
export { redact, computeDiff } from "./audit-redact";

export interface AuditEntry {
  clinicId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

type AuditClient = Pick<typeof prisma, "auditLog">;

export async function writeAudit(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client: AuditClient = (tx as unknown as AuditClient) ?? prisma;
  const data = {
    clinicId: entry.clinicId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes,
    metadata: entry.metadata,
  };

  if (tx) {
    // Atomicity was explicitly requested — let failures bubble so the
    // surrounding $transaction rolls back.
    await client.auditLog.create({ data });
    return;
  }

  try {
    await client.auditLog.create({ data });
  } catch (error) {
    logger.error("audit.write_failed", {
      err: error instanceof Error ? error.message : String(error),
      entry: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    });
  }
}

/**
 * Runs a mutation and its audit row inside a single $transaction so they
 * succeed or fail together. The transaction client is exposed to the
 * caller so all related writes (mutation + dependent reads) can share it.
 *
 * Usage:
 *
 *   const client = await withAudited(
 *     { clinicId, actorId, action: "CREATE", entityType: "Client" },
 *     async (tx) => tx.client.create({ data: { …, clinicId } }),
 *   );
 *
 * `entityId` is taken from the returned object's `id` field by default;
 * pass an explicit id for archive/restore-style actions that operate on
 * an already-known row.
 */
export async function withAudited<T extends { id: string }>(
  entry: Omit<AuditEntry, "entityId"> & { entityId?: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await fn(tx);
    await writeAudit(
      {
        ...entry,
        entityId: entry.entityId ?? result.id,
      },
      tx,
    );
    return result;
  });
}
