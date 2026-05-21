import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PetForm } from "@/components/pet-form";
import { createPet } from "../actions";

export const metadata: Metadata = {
  title: "New pet — PetTrack",
};

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const session = await requireSession();
  const { ownerId } = await searchParams;

  const owners = await prisma.owner.findMany({
    where: { clinicId: session.user.clinicId },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/pets" label="Back to pets" />
        <PageHeader
          title="New pet"
          description="Register a pet under one of your clients."
        />
      </div>

      {owners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add a client first"
          description="Pets belong to a client, so create the pet owner before registering a pet."
          action={
            <Link href="/clients/new" className={buttonVariants()}>
              Add a client
            </Link>
          }
        />
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <PetForm
              action={createPet}
              owners={owners.map((owner) => ({
                id: owner.id,
                name: `${owner.firstName} ${owner.lastName}`,
              }))}
              defaultValues={{
                ownerId: owners.some((owner) => owner.id === ownerId)
                  ? ownerId
                  : undefined,
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
