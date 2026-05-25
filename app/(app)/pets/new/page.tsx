import Link from "next/link";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PetForm } from "@/components/forms/pet-form";
import { buttonVariants } from "@/components/ui/button";

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const session = await requireSession();
  const { ownerId } = await searchParams;
  const [t, tCommon, tClient, owners] = await Promise.all([
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("client"),
    listClients({ clinicId: session.user.clinicId }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/pets" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {owners.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tClient("empty")}
          description=""
          action={
            <Link href="/clients/new" className={buttonVariants()}>
              {tClient("new")}
            </Link>
          }
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <PetForm
            owners={owners.map((o) => ({
              id: o.id,
              firstName: o.firstName,
              lastName: o.lastName,
            }))}
            defaultOwnerId={ownerId}
          />
        </div>
      )}
    </div>
  );
}
