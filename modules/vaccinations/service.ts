import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { ActionContext } from "@/lib/action";
import type { VaccinationInput } from "./schema";

export async function createVaccination(
  input: VaccinationInput,
  ctx: ActionContext,
) {
  const pet = await prisma.pet.findFirst({
    where: { id: input.petId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!pet) throw validationFailed({ petId: ["Hasta bulunamadı."] });

  const vaccination = await prisma.vaccination.create({
    data: {
      clinicId: ctx.clinicId,
      petId: input.petId,
      visitId: input.visitId || null,
      administeredById: input.administeredById || ctx.userId,
      name: input.name,
      manufacturer: input.manufacturer,
      lotNumber: input.lotNumber,
      site: input.site,
      administeredAt: input.administeredAt,
      nextDueAt: input.nextDueAt,
      notes: input.notes,
    },
  });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "CREATE",
    entityType: "Vaccination",
    entityId: vaccination.id,
    changes: { name: vaccination.name, petId: vaccination.petId },
  });
  return vaccination;
}

export async function deleteVaccination(id: string, ctx: ActionContext) {
  const existing = await prisma.vaccination.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("Aşı", id);

  await prisma.vaccination.delete({ where: { id } });
  await writeAudit({
    clinicId: ctx.clinicId,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "Vaccination",
    entityId: id,
  });
  return existing;
}
