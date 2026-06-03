import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { ClientInput } from "./schema";

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
        data: { ...input, clinicId: ctx.clinicId },
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
    select: { id: true },
  });
  if (!existing) throw notFound("Müşteri", id);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      changes: redact(input),
    },
    (tx) => tx.client.update({ where: { id }, data: input }),
  );
}

export async function archiveClient(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.archive");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) throw notFound("Müşteri", id);

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
  if (!existing) throw notFound("Müşteri", id);

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
