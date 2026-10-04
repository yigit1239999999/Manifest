import { getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/format";
import { getFormatContext } from "@/lib/format-context";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { defaultVetFor } from "@/modules/staff/default-vet";
import { can } from "@/lib/permissions";
import { getPetLabel, listPets } from "@/modules/pets/queries";
import { MissingLink } from "@/components/missing-link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { ownerLabel } from "@/lib/pet-label";
import {
  defaultAppointmentStart,
  parseAppointmentPrefill,
} from "@/modules/appointments/prefill";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    petId?: string;
    type?: string;
    reason?: string;
    date?: string;
  }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "appointments.write")) return <ForbiddenState />;
  const { petId, ...params } = await searchParams;
  // What the link that opened this form was about: the overdue vaccine,
  // the reminder's title, the day it falls due. See `prefill.ts`.
  const prefill = parseAppointmentPrefill(params);
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
            // Who it is booked with, by the same rule and out of the
            // same helper as `visits/new`.
            defaultVetId={defaultVetFor(vets, session.user.id)}
            defaultPetId={petId}
            defaultPetLabel={defaultPetLabel}
            defaultType={prefill.type}
            defaultReason={prefill.reason}
            // Here and not in the form: "now" and the clinic's opening
            // hours are both on the clinic's clock, which the server
            // has. Read once per request, so the field does not move
            // between the server render and hydration either.
            defaultStartsAt={defaultAppointmentStart({
              now: new Date(),
              date: prefill.date,
              timeZone: fmt.timeZone,
            })}
          />
        </Card>
      )}
    </div>
  );
}
