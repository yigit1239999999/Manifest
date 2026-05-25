import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { InvoiceForm } from "@/components/forms/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await requireSession();
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
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <InvoiceForm
          clients={clients.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          }))}
          defaultClientId={clientId}
          defaultNumber={defaultNumber}
        />
      </div>
    </div>
  );
}
