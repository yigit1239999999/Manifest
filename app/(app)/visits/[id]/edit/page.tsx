import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { can } from "@/lib/permissions";
import { getVisitById } from "@/modules/visits/queries";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { VisitForm } from "@/components/forms/visit-form";

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!can(session.user.role, "visits.write")) return <ForbiddenState />;
  const [visit, pets, vets, t, tCommon] = await Promise.all([
    getVisitById(session.user.clinicId, id),
    listPets({ clinicId: session.user.clinicId }),
    listClinicians(session.user.clinicId),
    getTranslations("visit"),
    getTranslations("common"),
  ]);
  if (!visit) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href={`/visits/${visit.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} />
      <Card className="p-6">
        <VisitForm
          visit={visit}
          pets={pets.items.map((p) => ({ id: p.id, name: p.name }))}
          petsCapped={pets.hasMore}
          vets={vets}
        />
      </Card>
    </div>
  );
}
