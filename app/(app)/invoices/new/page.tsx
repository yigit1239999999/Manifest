import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { InvoiceForm } from "@/components/forms/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "invoices.write")) return <ForbiddenState />;
  const { clientId } = await searchParams;
  const [t, tCommon, clients] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    listClients({ clinicId: session.user.clinicId }),
  ]);

  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request
  const defaultNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href="/invoices" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <Card className="p-6">
        <InvoiceForm
          clients={clients.items.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          }))}
          clientsCapped={clients.hasMore}
          defaultClientId={clientId}
          defaultNumber={defaultNumber}
        />
      </Card>
    </div>
  );
}
