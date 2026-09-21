import Link from "next/link";
import { Users } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { PetForm } from "@/components/forms/pet-form";
import { hiddenBuiltInSpecies } from "@/modules/pets/species-names";
import { buttonVariants } from "@/components/ui/button";

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "pets.write")) return <ForbiddenState />;
  const { ownerId } = await searchParams;
  const [
    t,
    tCommon,
    tClient,
    tSpecies,
    owners,
    customSpecies,
    clinicBreeds,
    enabledSpecies,
    defaultOwnerLabel,
  ] = await Promise.all([
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("client"),
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
      <BackLink href="/pets" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {owners.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tClient("empty")}
          description={t("noOwnersHint")}
          action={
            <Link href="/clients/new" className={buttonVariants()}>
              {tClient("new")}
            </Link>
          }
        />
      ) : (
        <Card className="p-6">
          <PetForm
            owners={owners.items.map((o) => ({
              id: o.id,
              firstName: o.firstName,
              lastName: o.lastName,
            }))}
            ownersCapped={owners.hasMore}
            defaultOwnerId={ownerId}
            defaultOwnerLabel={defaultOwnerLabel}
            customSpecies={customSpecies}
            clinicBreeds={clinicBreeds}
            enabledSpecies={enabledSpecies}
            hiddenBuiltIns={hiddenBuiltIns}
            hiddenQualifier={t("hiddenSpeciesQualifier")}
            enableHref={canManageSpecies ? "/settings" : undefined}
            enableLabel={canManageSpecies ? t("openSpeciesSettings") : undefined}
            manageHref={canManageSpecies ? "/settings" : undefined}
          />
        </Card>
      )}
    </div>
  );
}
