import { getLocale, getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientLabel, listClients } from "@/modules/clients/queries";
import { getVisitForInvoice } from "@/modules/visits/queries";
import { getInvoiceForVisit } from "@/modules/invoices/queries";
import { centsToInputValue } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { InvoiceForm } from "@/components/forms/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; visitId?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "invoices.write")) return <ForbiddenState />;
  const { clientId, visitId } = await searchParams;

  // Arrived from a visit that has already been billed — send the vet to
  // the bill instead of opening a second one.
  //
  // The visit page decides which action to show, but a link can be old,
  // bookmarked, or opened in a second tab after the first one billed.
  // Two invoices for one visit are two demands for the same money, and
  // the clinic hears about it from the client; the check belongs where
  // the invoice would be raised, not only where the button is drawn.
  // Both in one round trip: the second is not needed when the first
  // answers, but asking them in turn costs a serial wait on every
  // arrival from a visit, and the wasted read is a primary-key lookup.
  const [billed, visit] = visitId
    ? await Promise.all([
        getInvoiceForVisit(session.user.clinicId, visitId),
        getVisitForInvoice(session.user.clinicId, visitId),
      ])
    : [null, null];
  if (billed) redirect(`/invoices/${billed.id}`);
  // A visit names its own client, so a `clientId` in the URL is only
  // consulted when there is no visit to ask.
  const client = visit?.clientId ?? clientId;

  const [t, tCommon, tType, locale, clients, clientLabel] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getLocale(),
    listClients({ clinicId: session.user.clinicId }),
    // Only when a link carried a client: that client may sit past
    // the picker's cap, and then the field renders empty (`getClientLabel`).
    client ? getClientLabel(session.user.clinicId, client) : undefined,
  ]);

  // Composed from strings that are already translated rather than a new
  // message: the line says which visit is being billed, and "Aşı · 14
  // Eyl" is what a vet calls it. A new key would be a third place for
  // the same words to drift apart.
  const prefilledLine = visit
    ? {
        description: `${tType(visit.type)} · ${formatDate(locale, visit.visitedAt)}`,
        quantity: "1",
        // Blank rather than zero when the visit was never priced. A
        // prefilled "0,00" reads as the answer and gets submitted; an
        // empty required field asks the question.
        unitPrice:
          visit.totalCents != null
            ? centsToInputValue(locale, visit.totalCents)
            : "",
        petId: visit.petId,
        visitId: visit.id,
      }
    : undefined;

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
          defaultClientId={client}
          defaultClientLabel={clientLabel}
          defaultNumber={defaultNumber}
          prefilledLine={prefilledLine}
        />
      </Card>
    </div>
  );
}
