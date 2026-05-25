import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { ClientInput } from "./schema";

export async function createClient(input: ClientInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.write");
  const client = await prisma.client.create({
    data: { ...input, clinicId: ctx.clinicId },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Client",
    entityId: client.id,
    changes: input as unknown as Record<string, unknown>,
  });
  return client;
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

  const client = await prisma.client.update({ where: { id }, data: input });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Client",
    entityId: id,
    changes: input as unknown as Record<string, unknown>,
  });
  return client;
}

export async function archiveClient(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.archive");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) throw notFound("Müşteri", id);

  await prisma.client.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "ARCHIVE",
    entityType: "Client",
    entityId: id,
  });
}

export async function restoreClient(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "clients.archive");
  const existing = await prisma.client.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("Müşteri", id);

  await prisma.client.update({
    where: { id },
    data: { archivedAt: null },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "RESTORE",
    entityType: "Client",
    entityId: id,
  });
}
