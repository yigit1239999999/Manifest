import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientById } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!can(session.user.role, "clients.write")) return <ForbiddenState />;
  const [client, t, tCommon] = await Promise.all([
    getClientById(session.user.clinicId, id),
    getTranslations("client"),
    getTranslations("common"),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/clients/${client.id}`} label={tCommon("back")} />
      <PageHeader
        title={t("edit")}
        description={`${client.firstName} ${client.lastName}`}
      />
      <Card className="p-6">
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
