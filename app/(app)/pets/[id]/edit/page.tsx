import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { PetForm } from "@/components/pet-form";
import { updatePet } from "../../actions";

export const metadata: Metadata = {
  title: "Edit pet — PetTrack",
};

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const pet = await prisma.pet.findFirst({
    where: { id, clinicId: session.user.clinicId },
  });
  if (!pet) notFound();

  const owners = await prisma.owner.findMany({
    where: { clinicId: session.user.clinicId },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={`/pets/${pet.id}`} label="Back to pet" />
        <PageHeader title="Edit pet" description={`Update ${pet.name}'s details.`} />
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <PetForm
            action={updatePet.bind(null, pet.id)}
            owners={owners.map((owner) => ({
              id: owner.id,
              name: `${owner.firstName} ${owner.lastName}`,
            }))}
            defaultValues={{
              name: pet.name,
              species: pet.species,
              ownerId: pet.ownerId,
              breed: pet.breed,
              sex: pet.sex,
              birthDate: toDateInput(pet.birthDate),
              color: pet.color,
              weightKg: pet.weightKg,
              microchipId: pet.microchipId,
              notes: pet.notes,
            }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
