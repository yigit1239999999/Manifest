import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getPetById } from "@/modules/pets/queries";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { PetForm } from "@/components/forms/pet-form";

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [pet, owners, t, tCommon] = await Promise.all([
    getPetById(session.user.clinicId, id),
    listClients({ clinicId: session.user.clinicId }),
    getTranslations("pet"),
    getTranslations("common"),
  ]);
  if (!pet) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/pets/${pet.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} description={pet.name} />
      <PetForm
        pet={pet}
        owners={owners.map((o) => ({
          id: o.id,
          firstName: o.firstName,
          lastName: o.lastName,
        }))}
      />
    </div>
  );
}
