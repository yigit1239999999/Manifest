import { getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/format";
import { getFormatContext } from "@/lib/format-context";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { can } from "@/lib/permissions";
import { getPetLabel, listPets } from "@/modules/pets/queries";
import { MissingLink } from "@/components/missing-link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { ownerLabel } from "@/lib/pet-label";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "appointments.write")) return <ForbiddenState />;
  const { petId } = await searchParams;
  const [t, tCommon, pets, vets, defaultPetLabel, tSpecies, fmt] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("common"),
    listPets({ clinicId: session.user.clinicId }),
    listClinicians(session.user.clinicId),
    // Only when a link carried an animal: that animal may sit past
    // the picker's cap, and then the field renders empty (`getPetLabel`).
    petId ? getPetLabel(session.user.clinicId, petId) : undefined,
    getTranslations("enum.species"),
    getFormatContext(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/appointments" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {pets.items.length === 0 ? (
        <MissingLink need="pet" next="/appointments/new" />
      ) : (
        <Card className="p-6">
          <AppointmentForm
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
            vets={vets}
            // Who it is booked with, answered before the form opens --
            // the same rule, the same word and the same source as
            // `visits/new`: read off the clinician list this form is
            // already showing, so the default cannot be an id the
            // picker has no option for.
            defaultVetId={
              vets.some((v) => v.id === session.user.id)
                ? session.user.id
                : undefined
            }
            defaultPetId={petId}
            defaultPetLabel={defaultPetLabel}
          />
        </Card>
      )}
    </div>
  );
}
