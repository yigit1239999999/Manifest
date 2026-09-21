import Link from "next/link";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { PawPrint, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listPetsPage } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { SpeciesIcon } from "@/components/species-icon";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { petAge } from "@/lib/format";

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    species?: string;
    archived?: string;
  }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();

  // A button the server will refuse is worse than no button: the click
  // looks like it did nothing. The permission is the same one the service
  // enforces, read from one place (`lib/permissions.ts`).
  const canCreate = can(session.user.role, "pets.write");
  const { q, page: pageParam, species, archived } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const includeArchived = archived === "1";
  const [t, tCommon, tSpecies, result] = await Promise.all([
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("enum.species"),
    listPetsPage({
      clinicId: session.user.clinicId,
      search: q ?? null,
      species: species ?? null,
      includeArchived,
      page,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        {canCreate && (
          <Link href="/pets/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchForm action="/pets" placeholder={t("search")} defaultValue={q} />
        <FilterTabs
          basePath="/pets"
          param="archived"
          label={tCommon("archiveFilter")}
          active={includeArchived ? "1" : undefined}
          allLabel={tCommon("activeOnly")}
          options={[{ value: "1", label: tCommon("withArchived") }]}
          params={{ q, species }}
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title={q ? t("emptySearch") : t("empty")}
          description={q ? t("emptySearchHint") : t("emptyHint")}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((pet) => {
              const meta = [
                pet.customSpecies?.name ?? tSpecies(pet.species as never),
                pet.breed,
                petAge(fmt, pet.birthDate),
              ].filter(Boolean);
              return (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className={cn(surface, "group flex flex-col gap-3 p-4 shadow-sm transition-colors hover:border-primary/30")}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-accent text-accent-foreground">
                      <SpeciesIcon species={pet.species} className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {pet.name}
                        </span>
                        {/* An owner's archiving takes its animals with it, so
                            the card says "archived" for that too — otherwise
                            a pet nobody archived turns up in the archived
                            list with no explanation on it. */}
                        {(pet.archivedAt || pet.owner.archivedAt) && (
                          <StatusBadge
                            kind="archive"
                            status="archived"
                            label={tCommon("archived")}
                          />
                        )}
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
          <Pagination
            basePath="/pets"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ q, species, archived }}
          />
        </>
      )}
    </div>
  );
}
