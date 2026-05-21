import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerForm } from "@/components/owner-form";
import { updateOwner } from "../../actions";

export const metadata: Metadata = {
  title: "Edit client — PetTrack",
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const owner = await prisma.owner.findFirst({
    where: { id, clinicId: session.user.clinicId },
  });
  if (!owner) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={`/clients/${owner.id}`} label="Back to client" />
        <PageHeader
          title="Edit client"
          description={`Update ${owner.firstName} ${owner.lastName}'s details.`}
        />
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <OwnerForm
            action={updateOwner.bind(null, owner.id)}
            defaultValues={owner}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
