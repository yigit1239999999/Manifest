import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEnabledSpecies } from "@/modules/species/queries";
import {
  getPetById,
  listClinicBreedOptions,
  listCustomSpecies,
} from "@/modules/pets/queries";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { PetForm } from "@/components/forms/pet-form";

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!can(session.user.role, "pets.write")) return <ForbiddenState />;
  const [pet, owners, t, tCommon, customSpecies, clinicBreeds, enabledSpecies] =
    await Promise.all([
      getPetById(session.user.clinicId, id),
      listClients({ clinicId: session.user.clinicId }),
      getTranslations("pet"),
      getTranslations("common"),
      listCustomSpecies(session.user.clinicId),
      listClinicBreedOptions(session.user.clinicId),
      getEnabledSpecies(session.user.clinicId),
    ]);
  if (!pet) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/pets/${pet.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} description={pet.name} />
      <Card className="p-6">
        <PetForm
          pet={pet}
          owners={owners.items.map((o) => ({
            id: o.id,
            firstName: o.firstName,
            lastName: o.lastName,
          }))}
          ownersCapped={owners.hasMore}
          defaultOwnerLabel={`${pet.owner.firstName} ${pet.owner.lastName}`}
          customSpecies={customSpecies}
          clinicBreeds={clinicBreeds}
          enabledSpecies={enabledSpecies}
          manageHref={can(session.user.role, "settings.manage") ? "/settings" : undefined}
        />
      </Card>
    </div>
  );
}
