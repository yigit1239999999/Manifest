import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { ClientInput } from "./schema";

/**
 * The time and path of a consent answer, stamped only when the answer
 * actually changes (backlog 14b).
 *
 * The source is derived from the path, not asked of anyone: this service
 * is reached only through the client form, so the form is the source.
 * When a second path appears (an import, an owner-facing link) it passes
 * its own value here rather than reusing this one.
 *
 * Unchanged means unstamped. Re-saving a client to fix an address must
 * not move the date of a consent given a year ago -- that would turn the
 * proof into "last edited", which proves nothing.
 */
function consentStamp(
  answer: boolean | undefined,
  stored: boolean | null | undefined,
) {
  if (answer === undefined || answer === stored) return {};
  return {
    notificationsOptInAt: new Date(),
    notificationsOptInSource: "STAFF_FORM" as const,
  };
}

export async function createClient(input: ClientInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.write");
  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Client",
      changes: redact(input),
    },
    (tx) =>
      tx.client.create({
        data: {
          ...input,
          ...consentStamp(input.notificationsOptIn, null),
          clinicId: ctx.clinicId,
        },
      }),
  );
}

export async function updateClient(
  id: string,
  input: ClientInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "clients.write");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, notificationsOptIn: true },
  });
  if (!existing) throw notFound("client", id);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      changes: redact(input),
    },
    (tx) =>
      tx.client.update({
        where: { id },
        data: {
          ...input,
          ...consentStamp(input.notificationsOptIn, existing.notificationsOptIn),
        },
      }),
  );
}

export async function archiveClient(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.archive");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) throw notFound("client", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "ARCHIVE",
      entityType: "Client",
      entityId: id,
    },
    (tx) =>
      tx.client.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
  );
}

export async function restoreClient(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.archive");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("client", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "RESTORE",
      entityType: "Client",
      entityId: id,
    },
    (tx) =>
      tx.client.update({
        where: { id },
        data: { archivedAt: null },
      }),
  );
}
