import Link from "next/link";
import { PawPrint, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";
import { SpeciesIcon } from "@/components/species-icon";
import { buttonVariants } from "@/components/ui/button";
import { petAge } from "@/lib/format";

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;
  const [t, tSpecies, pets] = await Promise.all([
    getTranslations("pet"),
    getTranslations("enum.species"),
    listPets({ clinicId: session.user.clinicId, search: q ?? null }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/pets/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <SearchForm action="/pets" placeholder={t("search")} defaultValue={q} />

      {pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title={q ? t("emptySearch") : t("empty")}
          description=""
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => {
            const meta = [
              tSpecies(pet.species as never),
              pet.breed,
              petAge(pet.birthDate),
            ].filter(Boolean);
            return (
              <Link
                key={pet.id}
                href={`/pets/${pet.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <SpeciesIcon species={pet.species} className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {pet.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {meta.join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border pt-2.5 text-xs text-muted-foreground">
                  {t("owner")}:{" "}
                  <span className="font-medium text-foreground">
                    {pet.owner.firstName} {pet.owner.lastName}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
