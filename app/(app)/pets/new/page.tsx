import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getEnabledSpecies } from "@/modules/species/queries";
import { getClientLabel, listClients } from "@/modules/clients/queries";
import {
  listClinicBreedOptions,
  listCustomSpecies,
} from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { createHref, safeNext } from "@/lib/next-param";
import { PetForm } from "@/components/forms/pet-form";
import { hiddenBuiltInSpecies } from "@/modules/pets/species-names";

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string; next?: string; name?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "pets.write")) return <ForbiddenState />;
  const { ownerId, next, name } = await searchParams;
  // The errand the vet is on, and the one this page hands further down:
  // `/clients/new` needs to know where to come back to, which is here,
  // with everything this page was already carrying.
  const errand = safeNext(next);
  // Including whatever was typed on the way here, so a walk two links
  // deep comes back to this form as it was rather than as it opened.
  const ownErrand = createHref("/pets/new", name ?? "", errand);
  const [
    t,
    tCommon,
    tSpecies,
    owners,
    customSpecies,
    clinicBreeds,
    enabledSpecies,
    defaultOwnerLabel,
  ] = await Promise.all([
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("enum.species"),
    listClients({ clinicId: session.user.clinicId }),
    listCustomSpecies(session.user.clinicId),
    listClinicBreedOptions(session.user.clinicId),
    getEnabledSpecies(session.user.clinicId),
    // Only when a link carried an owner: that owner may sit past
    // the picker's cap, and then the field renders empty (`getClientLabel`).
    ownerId ? getClientLabel(session.user.clinicId, ownerId) : undefined,
  ]);

  // The built-ins this clinic switched off. Assembled here, on the
  // server, so the picker can recognise one by either of its names
  // without the browser carrying both message catalogues. None of this
  // changes the setting: it governs what is offered, and an animal on
  // the table is still whatever it is.
  const hiddenBuiltIns = hiddenBuiltInSpecies(
    enabledSpecies,
    (key) => tSpecies(key),
    (species) => t("hiddenSpeciesNote", { species }),
  );
  const canManageSpecies = can(session.user.role, "settings.manage");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Back means where they came from. Arriving on an errand, that
          is the form they left half-written, not the animal list --
          sending them to the list is how the visit gets abandoned. */}
      <BackLink href={errand ?? "/pets"} label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {/* No door in front of this form, even on a clinic with no
          clients. The owner box offers to make one from whatever is
          typed into it (`PetForm`), so there is no dead end for a door
          to stand in front of -- and the vet's rule was that a
          precondition is said INSIDE the form, not in its place.
          `MissingLink` still guards the screens that have no such box:
          `/appointments/new`, `/invoices/new` and the four lists, where
          somebody arriving from the side really can go no further. */}
      <Card className="p-6">
        <PetForm
          owners={owners.items.map((o) => ({
            id: o.id,
            firstName: o.firstName,
            lastName: o.lastName,
          }))}
          ownersCapped={owners.hasMore}
          defaultOwnerId={ownerId}
          // Capped like every other typed value that travels
          // (`MAX_TYPED` in `lib/next-param.ts`): the link is not a
          // place to put something else.
          defaultName={name?.slice(0, 80).trim() || undefined}
          errand={ownErrand}
          defaultOwnerLabel={defaultOwnerLabel}
          customSpecies={customSpecies}
          clinicBreeds={clinicBreeds}
          enabledSpecies={enabledSpecies}
          hiddenBuiltIns={hiddenBuiltIns}
          hiddenQualifier={t("hiddenSpeciesQualifier")}
          manageHref={canManageSpecies ? "/settings" : undefined}
          next={errand ?? undefined}
      />
      </Card>
    </div>
  );
}
