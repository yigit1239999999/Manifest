import { prisma } from "@/lib/prisma";

export async function listPrescriptionsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.prescription.findMany({
    where: { clinicId, petId },
    orderBy: { startedAt: "desc" },
    take,
    include: { prescribedBy: { select: { id: true, name: true } } },
  });
}

export async function activePrescriptions(clinicId: string, take = 20) {
  return prisma.prescription.findMany({
    where: { clinicId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    take,
    include: {
      pet: { select: { id: true, name: true, ownerId: true } },
    },
  });
}
