import { prisma } from "@/lib/prisma";

export async function listNotesForPet(clinicId: string, petId: string, take = 50) {
  return prisma.note.findMany({
    where: { clinicId, petId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function listNotesForClient(
  clinicId: string,
  clientId: string,
  take = 50,
) {
  return prisma.note.findMany({
    where: { clinicId, clientId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      author: { select: { id: true, name: true } },
      pet: { select: { id: true, name: true } },
    },
  });
}
