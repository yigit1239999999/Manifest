import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { NoteInput } from "./schema";

export async function createNote(input: NoteInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "notes.write");
  if (!input.petId && !input.clientId) {
    throw validationFailed({
      _form: ["Bir hasta veya müşteri belirtmelisin."],
    });
  }

  if (input.petId) {
    const pet = await prisma.pet.findFirst({
      where: { id: input.petId, clinicId: ctx.clinicId },
      select: { id: true, ownerId: true },
    });
    if (!pet) throw validationFailed({ petId: ["Hasta bulunamadı."] });
    if (!input.clientId) input.clientId = pet.ownerId;
  }
  if (input.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!client) throw validationFailed({ clientId: ["Müşteri bulunamadı."] });
  }

  const note = await prisma.note.create({
    data: {
      clinicId: ctx.clinicId,
      authorId: ctx.userId,
      petId: input.petId || null,
      clientId: input.clientId || null,
      kind: input.kind,
      body: input.body,
      pinned: input.pinned,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Note",
    entityId: note.id,
    changes: { kind: note.kind, petId: note.petId, clientId: note.clientId },
  });
  return note;
}

export async function deleteNote(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "notes.write");
  const existing = await prisma.note.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true, clientId: true },
  });
  if (!existing) throw notFound("Not", id);

  await prisma.note.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "Note",
    entityId: id,
  });
  return existing;
}

export async function togglePinned(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "notes.write");
  const existing = await prisma.note.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, pinned: true },
  });
  if (!existing) throw notFound("Not", id);

  await prisma.note.update({
    where: { id },
    data: { pinned: !existing.pinned },
  });
}
