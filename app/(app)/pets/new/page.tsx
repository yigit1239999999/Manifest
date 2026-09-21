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
    owners,
    customSpecies,
    clinicBreeds,
    enabledSpecies,
    defaultOwnerLabel,
  ] = await Promise.all([
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("client"),
    listClients({ clinicId: session.user.clinicId }),
    listCustomSpecies(session.user.clinicId),
    listClinicBreedOptions(session.user.clinicId),
    getEnabledSpecies(session.user.clinicId),
    // Only when a link carried an owner: that owner may sit past
    // the picker's cap, and then the field renders empty (`getClientLabel`).
    ownerId ? getClientLabel(session.user.clinicId, ownerId) : undefined,
  ]);

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
            manageHref={can(session.user.role, "settings.manage") ? "/settings" : undefined}
          />
        </Card>
      )}
    </div>
  );
}
