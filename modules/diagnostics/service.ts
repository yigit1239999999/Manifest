import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { DiagnosticInput } from "./schema";

export async function createDiagnostic(
  input: DiagnosticInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "diagnostics.write");
  // Entering a result and speaking for the person who decides are two
  // different acts. A technician does the first; writing an
  // interpretation is the second, because a written comment counts as
  // having read the result and would clear the unread marker.
  if (input.interpretation) requirePermission(ctx.userRole, "diagnostics.interpret");
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petRequired"] });

  const diagnostic = await prisma.diagnostic.create({
    data: {
      clinicId: ctx.clinicId,
      petId: input.petId,
      visitId: input.visitId || null,
      type: input.type,
      name: input.name,
      performedAt: input.performedAt,
      result: input.result,
      interpretation: input.interpretation,
      notes: input.notes,
      // Writing a comment is reading. Recorded at the moment it
      // happens rather than inferred later, so the marker always says
      // who and when rather than being reconstructed from a text
      // field being non-empty.
      readAt: input.interpretation ? new Date() : null,
      readById: input.interpretation ? ctx.userId : null,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Diagnostic",
    entityId: diagnostic.id,
    changes: { name: diagnostic.name, type: diagnostic.type },
  });
  return diagnostic;
}

export async function deleteDiagnostic(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "diagnostics.write");
  const existing = await prisma.diagnostic.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("diagnostic", id);

  await prisma.diagnostic.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "Diagnostic",
    entityId: id,
  });
  return existing;
}

/**
 * Says that the person who decides has seen this result.
 *
 * "Seen", and nothing more. Interpreting it is a separate act with
 * its own field, and requiring interpretation here would leave every
 * result that needs no comment unread for ever -- a count that cannot
 * reach zero is a count nobody reads.
 *
 * Behind `diagnostics.interpret` rather than `diagnostics.write`: the
 * marker means "it reached the person who decides", so anybody else
 * clearing it makes it stop answering its own question. That is the
 * whole of the state's meaning, not a permissions nicety.
 *
 * Idempotent, and the first reader keeps the record: marking twice
 * does not move the timestamp to whoever looked most recently, since
 * the question is when it first reached somebody who could act.
 */
export async function markDiagnosticRead(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "diagnostics.interpret");
  const existing = await prisma.diagnostic.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true, readAt: true },
  });
  if (!existing) throw notFound("diagnostic", id);
  if (existing.readAt) return existing;

  const readAt = new Date();
  await prisma.diagnostic.update({
    where: { id },
    data: { readAt, readById: ctx.userId },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "Diagnostic",
    entityId: id,
    changes: { readAt },
  });
  return existing;
}
