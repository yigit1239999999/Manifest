import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getClientById } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [client, t, tCommon] = await Promise.all([
    getClientById(session.user.clinicId, id),
    getTranslations("client"),
    getTranslations("common"),
  ]);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/clients/${client.id}`} label={tCommon("back")} />
      <PageHeader
        title={t("edit")}
        description={`${client.firstName} ${client.lastName}`}
      />
      <ClientForm client={client} />
    </div>
  );
}
