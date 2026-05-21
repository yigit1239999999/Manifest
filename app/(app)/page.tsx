import Link from "next/link";
import { ArrowRight, PawPrint, Plus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { firstName, speciesLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SpeciesIcon } from "@/components/species-icon";

function StatCard({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col">
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <ArrowRight className="ml-auto size-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default async function OverviewPage() {
  const session = await requireSession();
  const clinicId = session.user.clinicId;

  const [ownerCount, petCount, recentOwners, recentPets] = await Promise.all([
    prisma.owner.count({ where: { clinicId } }),
    prisma.pet.count({ where: { clinicId } }),
    prisma.owner.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { pets: true } } },
    }),
    prisma.pet.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { owner: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${firstName(session.user.name ?? "there")}`}
        description="A snapshot of your clinic today."
      >
        <Link
          href="/clients/new"
          className={buttonVariants({ variant: "secondary" })}
        >
          <Plus />
          New client
        </Link>
        <Link href="/pets/new" className={buttonVariants()}>
          <Plus />
          New pet
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard href="/clients" icon={Users} label="Clients" value={ownerCount} />
        <StatCard
          href="/pets"
          icon={PawPrint}
          label="Pets in care"
          value={petCount}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent clients</CardTitle>
            <Link
              href="/clients"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col">
            {recentOwners.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No clients yet. Add your first one to get started.
              </p>
            ) : (
              recentOwners.map((owner) => (
                <Link
                  key={owner.id}
                  href={`/clients/${owner.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {owner.firstName} {owner.lastName}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {owner._count.pets}{" "}
                    {owner._count.pets === 1 ? "pet" : "pets"}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent pets</CardTitle>
            <Link
              href="/pets"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col">
            {recentPets.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No pets yet. Add a pet once you have a client.
              </p>
            ) : (
              recentPets.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <SpeciesIcon species={pet.species} className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {pet.name}
                  </span>
                  <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                    {speciesLabel(pet.species)} · {pet.owner.firstName}{" "}
                    {pet.owner.lastName}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
