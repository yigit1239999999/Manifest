import { getLocale, getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientLabel, listClients } from "@/modules/clients/queries";
import { getVisitForInvoice } from "@/modules/visits/queries";
import { getInvoiceForVisit, lastVatRate } from "@/modules/invoices/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { DEFAULT_VAT_RATE, VAT_RATES, type VatRate } from "@/modules/invoices/schema";
import type { Line } from "@/components/forms/invoice-form";
import { centsToInputValue } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { MissingLink } from "@/components/missing-link";
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

  const [t, tCommon, tType, tDiagType, locale, clients, clientLabel, currency, lastRate] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("enum.diagnosticType"),
    getLocale(),
    listClients({ clinicId: session.user.clinicId }),
    // Only when a link carried a client: that client may sit past
    // the picker's cap, and then the field renders empty (`getClientLabel`).
    client ? getClientLabel(session.user.clinicId, client) : undefined,
    getClinicCurrency(session.user.clinicId),
    lastVatRate(session.user.clinicId),
  ]);
  const defaultVatRate: VatRate = (VAT_RATES as readonly number[]).includes(lastRate ?? -1)
    ? (lastRate as VatRate)
    : DEFAULT_VAT_RATE;

  // What the visit was, then what was done in it, one line each (B9):
  // "Aşı · 14 Eyl" alone billed a morning's work as one unnamed line.
  //
  // The visit line is composed from strings that are already translated,
  // and carries `kind: "VISIT"` so the invoice draws it in its reader's
  // language rather than in whoever raised it -- until somebody edits the
  // words, when they become the vet's own (see `InvoiceForm`).
  //
  // Every line carries the visit: that link is what stops the same visit
  // being billed twice, and it must survive the vet removing the visit
  // fee line and billing only the vaccine.
  const prefilledLines: Line[] | undefined = visit
    ? [
        {
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
          kind: "VISIT" as const,
        },
        ...visit.vaccinations.map((v) => ({ description: v.name, kind: "VACCINATION" as const })),
        ...visit.treatments.map((tr) => ({ description: tr.name, kind: "TREATMENT" as const })),
        ...visit.diagnostics.map((d) => ({
          description: d.name || tDiagType(d.type),
          kind: "DIAGNOSTIC" as const,
        })),
        ...visit.prescriptions.map((p) => ({
          description: [p.medicationName, p.dosage].filter(Boolean).join(" "),
          kind: "PRESCRIPTION" as const,
        })),
      ].map((line, i) =>
        i === 0
          ? (line as Line)
          : { ...line, quantity: "1", unitPrice: "", petId: visit.petId, visitId: visit.id },
      )
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href="/invoices" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      {clients.items.length === 0 ? (
        <MissingLink need="client" next="/invoices/new" />
      ) : (
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
            prefilledLines={prefilledLines}
            currency={currency}
            defaultVatRate={defaultVatRate}
            // A visit's fee is owed once it is billed. Opened as a draft,
            // it counted nowhere: neither the dashboard's outstanding
            // total nor the unpaid list includes drafts.
            defaultStatus={visit ? "SENT" : undefined}
          />
        </Card>
      )}
    </div>
  );
}
