import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/format";
import { getFormatContext } from "@/lib/format-context";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { can } from "@/lib/permissions";
import { getAppointmentById } from "@/modules/appointments/queries";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { ownerLabel } from "@/lib/pet-label";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!can(session.user.role, "appointments.write")) return <ForbiddenState />;
  const [appointment, pets, vets, t, tCommon, tSpecies, fmt] = await Promise.all([
    getAppointmentById(session.user.clinicId, id),
    listPets({ clinicId: session.user.clinicId }),
    listClinicians(session.user.clinicId),
    getTranslations("appointment"),
    getTranslations("common"),
    getTranslations("enum.species"),
    getFormatContext(),
  ]);
  if (!appointment) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/appointments/${appointment.id}`} label={tCommon("back")} />
      <PageHeader title={t("edit")} />
      <Card className="p-6">
        <AppointmentForm
          appointment={appointment}
          pets={pets.items.map((p) => ({
            id: p.id,
            name: p.name,
            // `listPets` already loads the owner; dropping it here was
            // how three of the four pickers lost it.
            ownerName: ownerLabel(p.owner),
            // Put into words here: the species catalogue and the
            // clinic's time zone are the server's, and the picker
            // row is where the vet tells two Pamuks apart.
            speciesLabel: p.customSpecies?.name ?? tSpecies(p.species),
            lastSeen: p.lastVisitAt ? relativeTime(fmt, p.lastVisitAt) : null,
          }))}
          petsCapped={pets.hasMore}
          defaultPetLabel={appointment.pet.name}
          vets={vets}
        />
      </Card>
    </div>
  );
}
