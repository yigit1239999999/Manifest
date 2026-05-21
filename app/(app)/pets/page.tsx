import Link from "next/link";
import { PawPrint, Plus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { petAge, speciesLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { SearchForm } from "@/components/search-form";
import { SpeciesIcon } from "@/components/species-icon";

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const pets = await prisma.pet.findMany({
    where: {
      clinicId: session.user.clinicId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { breed: { contains: query, mode: "insensitive" } },
              { owner: { firstName: { contains: query, mode: "insensitive" } } },
              { owner: { lastName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      owner: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pets" description="Every patient in your clinic's care.">
        <Link href="/pets/new" className={buttonVariants()}>
          <Plus />
          New pet
        </Link>
      </PageHeader>

      <SearchForm
        action="/pets"
        placeholder="Search by name, breed, owner…"
        defaultValue={query}
      />

      {pets.length === 0 ? (
        query ? (
          <EmptyState
            icon={PawPrint}
            title="No matching pets"
            description={`Nothing matches “${query}”. Try a different search.`}
          />
        ) : (
          <EmptyState
            icon={PawPrint}
            title="No pets yet"
            description="Register your first patient to start tracking their care."
            action={
              <Link href="/pets/new" className={buttonVariants()}>
                <Plus />
                New pet
              </Link>
            }
          />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => {
            const meta = [
              speciesLabel(pet.species),
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
                  Owner:{" "}
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
