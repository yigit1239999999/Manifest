import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getInvoiceById } from "@/modules/invoices/queries";
import { voidInvoiceAction } from "@/modules/invoices/actions";
import { PaymentForm } from "@/components/forms/payment-form";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const fmt = await getFormatContext();
  const { id } = await params;
  const session = await requireSession();
  const [invoice, t, tCommon, tStatus, tMethod] = await Promise.all([
    getInvoiceById(session.user.clinicId, id),
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("enum.paymentMethod"),
  ]);
  if (!invoice) notFound();

  // Voiding is the one permission in the app that only an administrator
  // holds, so until now every other role — the vets included — was shown
  // a button that always refused.
  const canVoid = can(session.user.role, "invoices.void");
  // Recording money taken is its own permission and its own service check
  // (`modules/invoices/service.ts:79`). The list of payments already made
  // stays visible either way: it is what the invoice says, not an action.
  const canRecordPayment = can(session.user.role, "payments.write");

  // The invoice's own currency, not the clinic's current setting: changing
  // the setting must not restate an invoice that was issued in another one.
  const currency = invoice.currency;

  const paidSoFar = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
  const remaining = invoice.totalCents - paidSoFar;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/invoices" label={tCommon("back")} />

      <PageHeader
        title={`#${invoice.number}`}
        description={`${invoice.client.firstName} ${invoice.client.lastName}`}
        badge={
          <StatusBadge
            kind="invoice"
            status={invoice.status}
            label={tStatus(invoice.status as never)}
          />
        }
      >
        {canVoid && invoice.status !== "VOID" && (
          <DeleteButton
            action={voidInvoiceAction.bind(null, invoice.id)}
            label={t("void")}
            confirmText={t("void") + "?"}
          />
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("lines")}</CardTitle>
          </CardHeader>
          {/* `px-0` so the header band reaches both edges of the card the
              way `DataTable`'s does. Inside the card's own `p-6` it would be
              an inset stripe, and the whole point of sharing the header
              style is that the two do not look like two different products.
              The cells carry the padding instead. */}
          <CardContent className="px-0">
            {/* The one hand-written table left, and deliberately not a
                `DataTable`: this is a document, not a list. It has a
                `<tfoot>` of running totals, no pagination, no empty state
                and no row to click. What it shares with `DataTable` is what
                a reader would notice if it differed — cell density, header
                style, and figures set in `tabular-nums` so the line totals
                line up with the totals underneath them. A different
                component does not mean a different-looking one.

                It stays hand-written because a `footer` slot and a "no
                card" variant, one call site each, would be a shared
                component told to stop sharing (TEAM.md #30). */}
            {/* Its own scroll container, for the same reason `DataTable`
                has one: four columns of figures do not fit a 390px card,
                and without this the page scrolled sideways instead of the
                table. `min-w-0` lets the box be narrower than its content;
                `min-w-sm` keeps the columns from collapsing into an
                unreadable stack before the scroll takes over. */}
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-sm text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("description")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("quantity")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("unitPrice")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("lineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">{l.description}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatMoney(fmt, l.unitPriceCents, currency)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatMoney(fmt, l.totalCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-end text-muted-foreground">
                    {t("subtotal")}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {formatMoney(fmt, invoice.subtotalCents, currency)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-end text-muted-foreground">
                    {t("tax")}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {formatMoney(fmt, invoice.taxCents, currency)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-end font-semibold">
                    {t("total")}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums">
                    {formatMoney(fmt, invoice.totalCents, currency)}
                  </td>
                </tr>
              </tfoot>
              </table>
            </div>
            {invoice.notes && (
              <p className="mx-4 mt-4 rounded-control bg-muted/40 p-3 text-sm">
                {invoice.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("outstanding")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {formatMoney(fmt, Math.max(0, remaining), currency)}
              </p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {t("paidAt")}: {formatMoney(fmt, paidSoFar, currency)} /{" "}
                {formatMoney(fmt, invoice.totalCents, currency)}
              </p>
            </CardContent>
          </Card>

          {canRecordPayment && invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("recordPayment")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentForm
                  invoiceId={invoice.id}
                  remainingCents={Math.max(0, remaining)}
                  currency={currency}
                />
              </CardContent>
            </Card>
          )}

          {invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>
                        {formatDateTime(fmt, p.paidAt)} · {tMethod(p.method as never)}
                      </span>
                      <span className="font-medium">
                        {formatMoney(fmt, p.amountCents, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
