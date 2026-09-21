import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { can } from "@/lib/permissions";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { AppointmentForm } from "@/components/forms/appointment-form";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "appointments.write")) return <ForbiddenState />;
  const { petId } = await searchParams;
  const [t, tCommon, pets, vets] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("common"),
    listPets({ clinicId: session.user.clinicId }),
    listClinicians(session.user.clinicId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/appointments" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <Card className="p-6">
        <AppointmentForm
          pets={pets.items.map((p) => ({ id: p.id, name: p.name }))}
          petsCapped={pets.hasMore}
          vets={vets}
          defaultPetId={petId}
        />
      </Card>
    </div>
  );
}
