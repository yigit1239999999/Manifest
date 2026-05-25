import { prisma } from "@/lib/prisma";

export interface ListPetsArgs {
  clinicId: string;
  search?: string | null;
  ownerId?: string | null;
  species?: string | null;
  includeArchived?: boolean;
  take?: number;
}

export async function listPets({
  clinicId,
  search,
  ownerId,
  species,
  includeArchived = false,
  take = 200,
}: ListPetsArgs) {
  const term = search?.trim();
  return prisma.pet.findMany({
    where: {
      clinicId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(ownerId ? { ownerId } : {}),
      ...(species ? { species: species as never } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { breed: { contains: term, mode: "insensitive" } },
              { microchipId: { contains: term } },
              {
                owner: {
                  OR: [
                    { firstName: { contains: term, mode: "insensitive" } },
                    { lastName: { contains: term, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getPetById(clinicId: string, id: string) {
  return prisma.pet.findFirst({
    where: { id, clinicId },
    include: {
      owner: true,
      _count: {
        select: {
          visits: true,
          vaccinations: true,
          prescriptions: true,
          treatments: true,
          diagnostics: true,
          notes_rel: true,
          documents: true,
        },
      },
    },
  });
}

export async function countPets(clinicId: string) {
  return prisma.pet.count({ where: { clinicId, archivedAt: null } });
}
