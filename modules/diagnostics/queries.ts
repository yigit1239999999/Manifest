import { prisma } from "@/lib/prisma";

export async function listDiagnosticsForPet(
  clinicId: string,
  petId: string,
  take = 50,
) {
  return prisma.diagnostic.findMany({
    where: { clinicId, petId },
    orderBy: { performedAt: "desc" },
    take,
  });
}
