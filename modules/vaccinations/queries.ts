import { prisma } from "@/lib/prisma";

export async function listVaccinationsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.vaccination.findMany({
    where: { clinicId, petId },
    orderBy: { administeredAt: "desc" },
    take,
    include: { administeredBy: { select: { id: true, name: true } } },
  });
}

export async function upcomingVaccinations(clinicId: string, take = 10) {
  return prisma.vaccination.findMany({
    where: {
      clinicId,
      nextDueAt: { not: null, gte: new Date() },
    },
    orderBy: { nextDueAt: "asc" },
    take,
    include: {
      pet: { select: { id: true, name: true, ownerId: true } },
    },
  });
}
