import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listPets } from "@/modules/pets/queries";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { VisitForm } from "@/components/forms/visit-form";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string }>;
}) {
  const session = await requireSession();
  const { petId } = await searchParams;
  const [t, tCommon, pets, vets] = await Promise.all([
    getTranslations("visit"),
    getTranslations("common"),
    listPets({ clinicId: session.user.clinicId }),
    prisma.user.findMany({
      where: { clinicId: session.user.clinicId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/visits" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <VisitForm
        pets={pets.map((p) => ({ id: p.id, name: p.name }))}
        vets={vets}
        defaultPetId={petId}
      />
    </div>
  );
}
