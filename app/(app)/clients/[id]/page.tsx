import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, PawPrint, Pencil, Phone, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { PetCard } from "@/components/pet-card";
import { deleteOwner } from "../actions";

function ContactRow({
  icon: Icon,
  value,
}: {
  icon: LucideIcon;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const owner = await prisma.owner.findFirst({
    where: { id, clinicId: session.user.clinicId },
    include: { pets: { orderBy: { name: "asc" } } },
  });
  if (!owner) notFound();

  const hasContact = Boolean(owner.email || owner.phone || owner.address);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/clients" label="Back to clients" />

      <PageHeader
        title={`${owner.firstName} ${owner.lastName}`}
        description="Client profile"
      >
        <Link
          href={`/clients/${owner.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Pencil />
          Edit
        </Link>
        <DeleteButton
          action={deleteOwner.bind(null, owner.id)}
          confirmText={`Delete ${owner.firstName} ${owner.lastName}? This also removes their pets and cannot be undone.`}
        />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {hasContact ? (
              <>
                <ContactRow icon={Mail} value={owner.email} />
                <ContactRow icon={Phone} value={owner.phone} />
                <ContactRow icon={MapPin} value={owner.address} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No contact details yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {owner.notes || "No notes yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Pets ({owner.pets.length})
          </h2>
          <Link
            href={`/pets/new?ownerId=${owner.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Plus />
            Add pet
          </Link>
        </div>

        {owner.pets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <PawPrint className="size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                No pets registered for this client yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owner.pets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
