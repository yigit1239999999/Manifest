import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getInvoiceById } from "@/modules/invoices/queries";
import { voidInvoiceAction } from "@/modules/invoices/actions";
import { PaymentForm } from "@/components/forms/payment-form";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { Badge } from "@/components/ui/badge";
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
  const { id } = await params;
  const session = await requireSession();
  const [invoice, t, tCommon, tStatus, tMethod, clinic] = await Promise.all([
    getInvoiceById(session.user.clinicId, id),
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("enum.paymentMethod"),
    prisma.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: { currency: true },
    }),
  ]);
  if (!invoice) notFound();
  const currency = clinic?.currency ?? "USD";

  const paidSoFar = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
  const remaining = invoice.totalCents - paidSoFar;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/invoices" label={tCommon("back")} />

      <PageHeader
        title={`#${invoice.number}`}
        description={`${invoice.client.firstName} ${invoice.client.lastName}`}
      >
        <Badge variant="secondary">{tStatus(invoice.status as never)}</Badge>
        {invoice.status !== "VOID" && (
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
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">{t("description")}</th>
                  <th className="py-2 text-right">{t("quantity")}</th>
                  <th className="py-2 text-right">{t("unitPrice")}</th>
                  <th className="py-2 text-right">{t("lineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2">{l.description}</td>
                    <td className="py-2 text-right">{l.quantity}</td>
                    <td className="py-2 text-right">
                      {formatMoney(l.unitPriceCents, currency)}
                    </td>
                    <td className="py-2 text-right">
                      {formatMoney(l.totalCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border text-sm">
                <tr>
                  <td colSpan={3} className="py-2 text-right text-muted-foreground">
                    {t("subtotal")}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(invoice.subtotalCents, currency)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 text-right text-muted-foreground">
                    {t("tax")}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(invoice.taxCents, currency)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 text-right font-semibold">
                    {t("total")}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {formatMoney(invoice.totalCents, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {invoice.notes && (
              <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
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
              <p className="text-2xl font-semibold">
                {formatMoney(Math.max(0, remaining), currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("paidAt")}: {formatMoney(paidSoFar, currency)} /{" "}
                {formatMoney(invoice.totalCents, currency)}
              </p>
            </CardContent>
          </Card>

          {invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("recordPayment")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentForm
                  invoiceId={invoice.id}
                  remainingCents={Math.max(0, remaining)}
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
                        {formatDateTime(p.paidAt)} · {tMethod(p.method as never)}
                      </span>
                      <span className="font-medium">
                        {formatMoney(p.amountCents, currency)}
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
