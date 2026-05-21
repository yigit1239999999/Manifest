import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDate, petAge, sexLabel, speciesLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { SpeciesIcon } from "@/components/species-icon";
import { deletePet } from "../actions";

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const pet = await prisma.pet.findFirst({
    where: { id, clinicId: session.user.clinicId },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!pet) notFound();

  const details: { label: string; value: string }[] = [
    { label: "Species", value: speciesLabel(pet.species) },
    { label: "Breed", value: pet.breed || "—" },
    { label: "Sex", value: sexLabel(pet.sex) },
    { label: "Date of birth", value: formatDate(pet.birthDate) },
    { label: "Age", value: petAge(pet.birthDate) ?? "—" },
    { label: "Color / markings", value: pet.color || "—" },
    {
      label: "Weight",
      value: pet.weightKg != null ? `${pet.weightKg} kg` : "—",
    },
    { label: "Microchip ID", value: pet.microchipId || "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/pets" label="Back to pets" />

      <PageHeader title={pet.name} description="Pet profile">
        <Link
          href={`/pets/${pet.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Pencil />
          Edit
        </Link>
        <DeleteButton
          action={deletePet.bind(null, pet.id)}
          confirmText={`Delete ${pet.name}? This cannot be undone.`}
        />
      </PageHeader>

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <SpeciesIcon species={pet.species} className="size-7" />
        </span>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-foreground">
            {pet.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {[speciesLabel(pet.species), pet.breed].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {detail.label}
                  </dt>
                  <dd className="text-sm text-foreground">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Owner</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/clients/${pet.owner.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {pet.owner.firstName} {pet.owner.lastName}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {pet.notes || "No notes yet."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
