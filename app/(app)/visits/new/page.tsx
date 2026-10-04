import { getTranslations } from "next-intl/server";
import { relativeTime } from "@/lib/format";
import { getFormatContext } from "@/lib/format-context";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { listClinicians } from "@/modules/staff/queries";
import { defaultVetFor } from "@/modules/staff/default-vet";
import { can } from "@/lib/permissions";
import { getPetForVisit, listCustomSpecies, listPets } from "@/modules/pets/queries";
import { getAppointmentToStartVisit } from "@/modules/appointments/queries";
import { getEnabledSpecies } from "@/modules/species/queries";
import { listClients } from "@/modules/clients/queries";
import { hiddenBuiltInSpecies } from "@/modules/pets/species-names";
import { SPECIES } from "@/modules/pets/schema";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { VisitForm } from "@/components/forms/visit-form";
import { ownerLabel } from "@/lib/pet-label";
import { VISIT_TYPES } from "@/modules/appointments/schema";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string; type?: string; appointmentId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "visits.write")) return <ForbiddenState />;
  const { petId, type, appointmentId } = await searchParams;
  // Set by an appointment's "Start visit". Anything that is not a visit
  // type is ignored, so the form keeps its own default rather than
  // drawing a select with nothing chosen.
  const defaultType = VISIT_TYPES.find((v) => v === type);
  // The animal and its owner are opened inside this form now, so this
  // page loads what `pets/new` loads: the clinic's species catalogue,
  // its clients, and the built-ins it has switched off. One round of
  // queries for a screen that used to be three.
  const [
    t,
    tCommon,
    tPet,
    pets,
    vets,
    linkedPet,
    tSpecies,
    fmt,
    owners,
    customSpecies,
    enabledSpecies,
    startable,
  ] = await Promise.all([
    getTranslations("visit"),
    getTranslations("common"),
    getTranslations("pet"),
    listPets({ clinicId: session.user.clinicId }),
    listClinicians(session.user.clinicId),
    // Only when a link carried an animal: that animal may sit past
    // the picker's cap, and then the field renders empty (`getPetLabel`).
    // Its alerts and species come in the same lookup.
    petId ? getPetForVisit(session.user.clinicId, petId) : undefined,
    getTranslations("enum.species"),
    getFormatContext(),
    listClients({ clinicId: session.user.clinicId }),
    listCustomSpecies(session.user.clinicId),
    getEnabledSpecies(session.user.clinicId),
    // Set by an appointment's "Start visit", so the reason the owner
    // gave on the phone is not typed a second time and the save can
    // mark the appointment as attended.
    typeof appointmentId === "string" && appointmentId
      ? getAppointmentToStartVisit(session.user.clinicId, appointmentId)
      : null,
  ]);
  // Ignored, silently, when it is for some other animal than the link
  // names: the page then opens exactly as it would without it.
  const appointment =
    startable && (!petId || startable.petId === petId) ? startable : null;
  // The animal this visit is known to be about before the form opens.
  // The link always carries `petId`; an address with only the
  // appointment costs the one extra lookup.
  const startPet =
    linkedPet ??
    (appointment && !petId
      ? await getPetForVisit(session.user.clinicId, appointment.petId)
      : undefined);

  // Assembled on the server for the reason `pets/new/page.tsx` gives:
  // the names come from both catalogues and the browser has only the
  // active one.
  const hiddenBuiltIns = hiddenBuiltInSpecies(
    enabledSpecies,
    (key) => tSpecies(key),
    (species) => tPet("hiddenSpeciesNote", { species }),
  );
  // The block writes an animal and, when its owner is new, a client.
  // `createVisitWithIntake` requires both permissions, so an offer this
  // reader cannot take would be a server error rather than a message.
  // The chips this clinic offers, in the same order `PetForm` builds
  // them: the built-ins it has left on, then the ones it defined.
  const speciesChoices = [
    ...SPECIES.filter((sp) => enabledSpecies.includes(sp)).map((sp) => ({
      value: sp as string,
      label: tSpecies(sp),
      icon: sp as string,
    })),
    ...customSpecies.map((cs) => ({
      value: `custom:${cs.id}`,
      label: cs.name,
      icon: "OTHER",
    })),
  ];
  const canCreatePet = can(session.user.role, "pets.write");
  const canCreateOwner = can(session.user.role, "clients.write");

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
            // WHO owns it, not just what they are called: the form
            // decides whether a typed name reached one person or two
            // by id (`offerFor`), because two clients with one name is
            // the ordinary case and spelling cannot tell them apart.
            ownerId: p.ownerId,
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
          // Who performed it, answered before the form opens; the
          // reasoning and the receptionist case live in the helper.
          defaultVetId={defaultVetFor(vets, session.user.id)}
          defaultPetId={petId ?? startPet?.id}
          defaultPetLabel={startPet?.label}
          defaultPetAlerts={startPet?.alerts}
          defaultPetSpecies={startPet?.species}
          defaultType={defaultType}
          appointmentId={appointment?.id}
          defaultChiefComplaint={appointment?.reason ?? undefined}
          owners={owners.items.map((o) => ({
            id: o.id,
            firstName: o.firstName,
            lastName: o.lastName,
          }))}
          ownersCapped={owners.hasMore}
          speciesChoices={speciesChoices}
          hiddenBuiltIns={hiddenBuiltIns}
          hiddenQualifier={tPet("hiddenSpeciesQualifier")}
          manageHref={
            can(session.user.role, "settings.manage") ? "/settings" : undefined
          }
          canCreatePet={canCreatePet}
          canCreateOwner={canCreateOwner}
        />
      </Card>
    </div>
  );
}
