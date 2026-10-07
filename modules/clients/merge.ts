import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import { ownerLabel } from "@/lib/pet-label";
import { comparableDigits } from "./duplicates";

/**
 * Every table that points at a client, and the column it points with.
 *
 * The merge moves exactly these, and `merge.test.ts` reads the schema and
 * fails if a model gains a relation to `Client` that is not listed here:
 * a table left out is a row left pointing at an archived duplicate, which
 * is the orphan the merge exists to prevent -- found months later, when
 * somebody asks why an invoice is missing from a client's page.
 */
export const CLIENT_REFERENCES = [
  { model: "pet", column: "ownerId", key: "pets" },
  { model: "visit", column: "clientId", key: "visits" },
  { model: "appointment", column: "clientId", key: "appointments" },
  { model: "invoice", column: "clientId", key: "invoices" },
  { model: "reminder", column: "clientId", key: "reminders" },
  { model: "note", column: "clientId", key: "notes" },
  { model: "document", column: "clientId", key: "documents" },
  { model: "messageLog", column: "clientId", key: "messages" },
] as const;

export type MergeCounts = Record<(typeof CLIENT_REFERENCES)[number]["key"], number>;

type Delegate = {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
};

function delegate(client: unknown, model: string): Delegate {
  return (client as Record<string, Delegate>)[model];
}

async function loadPair(sourceId: string, targetId: string, clinicId: string) {
  if (sourceId === targetId) throw conflict("error.validation.mergeSameClient");
  const [source, target] = await Promise.all([
    prisma.client.findFirst({ where: { id: sourceId, clinicId } }),
    prisma.client.findFirst({ where: { id: targetId, clinicId } }),
  ]);
  if (!source) throw notFound("client", sourceId);
  if (!target) throw notFound("client", targetId);
  if (target.archivedAt) throw conflict("error.validation.mergeIntoArchived");
  return { source, target };
}

/** What a merge would move, for the confirmation to say in numbers. */
export async function mergePreview(
  sourceId: string,
  targetId: string,
  ctx: ActionContext,
): Promise<{ counts: MergeCounts; source: string; target: string }> {
  requirePermission(ctx.userRole, "clients.merge");
  const { source, target } = await loadPair(sourceId, targetId, ctx.clinicId);
  const entries = await Promise.all(
    CLIENT_REFERENCES.map(async ({ model, column, key }) => [
      key,
      await delegate(prisma, model).count({
        where: { clinicId: ctx.clinicId, [column]: sourceId },
      }),
    ]),
  );
  return {
    counts: Object.fromEntries(entries) as MergeCounts,
    source: ownerLabel(source),
    target: ownerLabel(target),
  };
}

/** The contact fields a merge fills in on the kept record when it has none. */
const FILLABLE = [
  "email",
  "secondaryPhone",
  "address",
  "city",
  "postalCode",
  "country",
  "preferredContact",
  "preferredLanguage",
] as const;

/**
 * Folds `sourceId` into `targetId`: every animal, visit, appointment,
 * invoice (and with it its payments, which hang off the invoice),
 * reminder, note, document and message log moves to the kept record, in
 * one transaction, tenant-scoped on every statement.
 *
 * What the kept record lacks it takes from the other -- an e-mail, an
 * address, the second number -- and never the other way round: a field
 * somebody filled in on the kept record is not overwritten by the
 * duplicate's. The duplicate's own phone, when different, becomes the
 * kept record's second number if that is empty, so a number the clinic
 * has rung is not lost with the record it was on.
 *
 * The emptied record is archived, not deleted: the audit log and any
 * link somebody saved still lead somewhere, and its page says where the
 * history went (via the audit entry). Administrators only.
 */
export async function mergeClients(
  sourceId: string,
  targetId: string,
  ctx: ActionContext,
): Promise<{ counts: MergeCounts; targetId: string }> {
  requirePermission(ctx.userRole, "clients.merge");
  const { source, target } = await loadPair(sourceId, targetId, ctx.clinicId);

  const fill: Record<string, unknown> = {};
  for (const field of FILLABLE) {
    if (!target[field] && source[field]) fill[field] = source[field];
  }
  if (
    !target.secondaryPhone &&
    !fill.secondaryPhone &&
    source.phone &&
    // The same number written another way is not a second number.
    comparableDigits(source.phone) !== comparableDigits(target.phone)
  ) {
    fill.secondaryPhone = source.phone;
  }
  if (!target.phone && source.phone) fill.phone = source.phone;
  if (target.notificationsOptIn === null && source.notificationsOptIn !== null) {
    fill.notificationsOptIn = source.notificationsOptIn;
    fill.notificationsOptInAt = source.notificationsOptInAt;
    fill.notificationsOptInSource = source.notificationsOptInSource;
  }
  if (source.notes?.trim()) {
    fill.notes = target.notes?.trim()
      ? `${target.notes.trim()}\n\n${source.notes.trim()}`
      : source.notes.trim();
  }

  const counts = await prisma.$transaction(async (tx) => {
    const moved: Record<string, number> = {};
    for (const { model, column, key } of CLIENT_REFERENCES) {
      const { count } = await delegate(tx, model).updateMany({
        where: { clinicId: ctx.clinicId, [column]: sourceId },
        data: { [column]: targetId },
      });
      moved[key] = count;
    }
    if (Object.keys(fill).length > 0) {
      await tx.client.update({ where: { id: targetId }, data: fill });
    }
    await tx.client.update({
      where: { id: sourceId },
      data: { archivedAt: source.archivedAt ?? new Date() },
    });
    // Two entries, one per record, so each one's history says what
    // happened to it in words a person reads back: where this one's
    // records went, and where that one's came from.
    await writeAudit(
      {
        clinicId: ctx.clinicId,
        actorId: ctx.userId,
        action: "UPDATE",
        entityType: "Client",
        entityId: targetId,
        changes: {
          mergedFrom: { id: sourceId, name: ownerLabel(source) },
          moved,
          filled: Object.keys(fill),
        },
      },
      tx,
    );
    await writeAudit(
      {
        clinicId: ctx.clinicId,
        actorId: ctx.userId,
        action: "ARCHIVE",
        entityType: "Client",
        entityId: sourceId,
        changes: { mergedInto: { id: targetId, name: ownerLabel(target) }, moved },
      },
      tx,
    );
    return moved as MergeCounts;
  });

  return { counts, targetId };
}
