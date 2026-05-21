import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerForm } from "@/components/owner-form";
import { createOwner } from "../actions";

export const metadata: Metadata = {
  title: "New client — PetTrack",
};

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/clients" label="Back to clients" />
        <PageHeader
          title="New client"
          description="Add a pet owner to your clinic."
        />
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <OwnerForm action={createOwner} />
        </CardContent>
      </Card>
    </div>
  );
}
