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
