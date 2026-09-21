import { getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/format";
import { getFormatContext } from "@/lib/format-context";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { can } from "@/lib/permissions";
import { getPetLabel, listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { VisitForm } from "@/components/forms/visit-form";
import { ownerLabel } from "@/lib/pet-label";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "visits.write")) return <ForbiddenState />;
  const { petId } = await searchParams;
  const [t, tCommon, pets, vets, defaultPetLabel, tSpecies, fmt] = await Promise.all([
    getTranslations("visit"),
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href="/visits" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {/* The form, on the first morning as on every other one. This is
          the screen the dashboard card sends an empty clinic to, having
          promised that the animal and its owner can be made on the way
          -- and what stood here was a door saying an animal has to
          exist first, then a second door saying an owner does. "The dog
          is on the table, the owner is crying, and what I got was not a
          blank page but a door. Do not make me a liar."
          The animal box keeps that promise now: it offers to make what
          was typed into it, under whatever it found. */}
      <Card className="p-6">
        <VisitForm
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
          // Who performed it, answered before the form opens.
          //
          // The service will not guess this any more -- `vetId ||
          // ctx.userId` put the receptionist who typed a visit up on
          // the record as the clinician who performed it, and nobody
          // goes back to correct that field. What was wrong there was
          // the guessing, not the answer: a vet filling in their own
          // examination is the ordinary case, and the honest place to
          // say so is the screen, where they can see it and change it.
          //
          // Read off the list the form is already showing rather than
          // asked for again (`isClinician` is the same predicate over
          // the same rows): one fewer round trip, and the default is
          // guaranteed to be an option the picker actually has.
          defaultVetId={
            vets.some((v) => v.id === session.user.id)
              ? session.user.id
              : undefined
          }
          defaultPetId={petId}
          defaultPetLabel={defaultPetLabel}
        />
      </Card>
    </div>
  );
}
