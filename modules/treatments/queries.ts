import { prisma } from "@/lib/prisma";

export async function listTreatmentsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.treatment.findMany({
    where: { clinicId, petId },
    orderBy: { performedAt: "desc" },
    take,
    include: { performedBy: { select: { id: true, name: true } } },
  });
}
