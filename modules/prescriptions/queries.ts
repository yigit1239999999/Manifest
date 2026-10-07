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

/**
 * One prescription with everything its printed copy names: the animal and
 * its owner, the prescriber, the visit it was written at. Clinic-scoped.
 */
export async function getPrescriptionForPrint(clinicId: string, id: string) {
  return prisma.prescription.findFirst({
    where: { id, clinicId },
    include: {
      prescribedBy: { select: { name: true, role: true } },
      pet: {
        select: {
          name: true,
          species: true,
          breed: true,
          sex: true,
          birthDate: true,
          weightKg: true,
          microchipId: true,
          customSpecies: { select: { name: true } },
          owner: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
      visit: { select: { visitedAt: true, weightKg: true } },
    },
  });
}
