import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getInvoiceById } from "@/modules/invoices/queries";
import {
  markInvoiceSentAction,
  voidInvoiceAction,
  voidPaymentAction,
} from "@/modules/invoices/actions";
import { MarkSentButton } from "@/components/mark-sent-button";
import { PaymentForm } from "@/components/forms/payment-form";
import { PaymentVoidButton } from "@/components/payment-void-button";
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
import Link from "next/link";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";

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
  const canWrite = can(session.user.role, "invoices.write");
  // Recording money taken is its own permission and its own service check
  // (`modules/invoices/service.ts:79`). The list of payments already made
  // stays visible either way: it is what the invoice says, not an action.
  const canRecordPayment = can(session.user.role, "payments.write");

  // The invoice's own currency, not the clinic's current setting: changing
  // the setting must not restate an invoice that was issued in another one.
  const currency = invoice.currency;

  // A voided payment stays in the list below but no longer counts.
  const paidSoFar = invoice.payments.reduce(
    (s, p) => (p.voidedAt ? s : s + p.amountCents),
    0,
  );
  const remaining = invoice.totalCents - paidSoFar;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/invoices" label={tCommon("back")} />

      <PageHeader
        title={`#${invoice.number}`}
        description={ownerLabel(invoice.client)}
        badge={
          <StatusBadge
            kind="invoice"
            status={invoice.status}
            label={tStatus(invoice.status as never)}
          />
        }
      >
        {canWrite && invoice.status === "DRAFT" && (
          <MarkSentButton
            action={markInvoiceSentAction.bind(null, invoice.id)}
            label={t("markSent")}
          />
        )}
        {canVoid && invoice.status !== "VOID" && (
          <DeleteButton
            action={voidInvoiceAction.bind(null, invoice.id)}
            label={t("void")}
            confirmText={t("void") + "?"}
          />
        )}
      </PageHeader>

      {/* `[&>*]:min-w-0` on the children, not decoration. A grid item
          refuses by default to be narrower than its own content, so a card
          holding something wide — the invoice line table — grew past the
          screen and took the page sideways with it at 390px. A scroll
          container inside is only as good as the chain above it, which is
          why the one already on the table did not help (TEAM.md #27). */}
      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2 lg:self-start">
          <CardHeader>
            <CardTitle>{t("lines")}</CardTitle>
          </CardHeader>
          {/* `px-0` so the header band reaches both edges of the card the
              way `DataTable`'s does. Inside the card's own `p-6` it would be
              an inset stripe, and the whole point of sharing the header
              style is that the two do not look like two different products.
              The cells carry the padding instead. */}
          <CardContent className="@container px-0">
            {/* The one hand-written table left, and deliberately not a
                `DataTable`: this is a document, not a list. It has its
                running totals under it, no pagination, no empty state
                and no row to click. What it shares with `DataTable` is what
                a reader would notice if it differed — cell density, header
                style, and figures set in `tabular-nums` so the line totals
                line up with the totals underneath them. A different
                component does not mean a different-looking one.

                It stays hand-written because a `footer` slot and a "no
                card" variant, one call site each, would be a shared
                component told to stop sharing (TEAM.md #30). */}
            {/* Four columns of figures do not fit a phone. This used to be
                solved by scrolling: the table kept a 384px minimum inside
                a 292px card, and pm found what that meant at 390px: the
                "Total" label on screen and the total itself past the edge,
                with nothing to say there was more. The one figure the page
                exists for was the one you could not see.

                Now the quantity and unit price columns step aside below
                24rem of *card* (a container query: on desktop the card is
                two thirds of a grid, so the screen's width says nothing
                about it), and ride under the description as "2 × 500,00"
                until their columns come back, at the same `@sm`. What is
                left is the description and the line total, which fits.
                The scroll container stays as a floor, not as the plan. */}
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("description")}</th>
                  <th className="hidden px-4 py-3 text-end font-medium @sm:table-cell">{t("quantity")}</th>
                  <th className="hidden px-4 py-3 text-end font-medium @sm:table-cell">{t("unitPrice")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("lineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      {l.description}
                      {/* The two hidden columns, riding along. Hidden at
                          `@sm`, the breakpoint their columns arrive at,
                          so between them they are always on screen once
                          and never twice. */}
                      <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums @sm:hidden">
                        {t("quantityTimesPrice", {
                          quantity: l.quantity,
                          unitPrice: formatMoney(fmt, l.unitPriceCents, currency),
                        })}
                      </span>
                      {/* The other half of the two-way link: a visit
                          says which invoice it went to, and here the
                          invoice says which visit it came from. On the
                          line and not in the header, because an invoice
                          can gather several visits and one link up there
                          would have to pick one and be wrong about the
                          rest.

                          Shape and wording are ux's; this is the
                          smallest honest version so the column is not
                          filled and invisible, which is the same as not
                          having it. */}
                      {l.visit && (
                        <Link
                          href={`/visits/${l.visit.id}`}
                          className="mt-0.5 block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {t("fromVisit", {
                            date: formatDate(fmt, l.visit.visitedAt),
                          })}
                        </Link>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-end tabular-nums @sm:table-cell">{l.quantity}</td>
                    <td className="hidden px-4 py-3 text-end tabular-nums @sm:table-cell">
                      {formatMoney(fmt, l.unitPriceCents, currency)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatMoney(fmt, l.totalCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {/* The totals are out of the table and under it. As a
                `<tfoot>` they had to span "every column but the last",
                and that count changes with the card's width now; a
                `colSpan` that spans hidden columns invents a new one and
                pushes the figures out of line. Here they are a list of
                label and amount, outside any scroll container, so the
                total is on screen at every width. Amounts end on the same
                `px-4` edge as the line totals above them. */}
            <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-3 border-t border-border px-4 py-3 text-sm">
              <dt className="text-end text-muted-foreground">{t("subtotal")}</dt>
              <dd className="text-end tabular-nums">
                {formatMoney(fmt, invoice.subtotalCents, currency)}
              </dd>
              <dt className="text-end text-muted-foreground">{t("tax")}</dt>
              <dd className="text-end tabular-nums">
                {formatMoney(fmt, invoice.taxCents, currency)}
              </dd>
              <dt className="text-end font-semibold">{t("total")}</dt>
              <dd className="text-end font-semibold tabular-nums">
                {formatMoney(fmt, invoice.totalCents, currency)}
              </dd>
            </dl>
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
                <CardTitle>{t("payment.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {invoice.payments.map((p) => {
                    const amount = formatMoney(fmt, p.amountCents, currency);
                    // Struck and quiet, not removed: the row is the record
                    // that this amount was entered and taken back.
                    if (p.voidedAt) {
                      return (
                        <li key={p.id} className="flex flex-col text-muted-foreground">
                          <span className="flex justify-between gap-2">
                            <span className="line-through">
                              {formatDateTime(fmt, p.paidAt)} · {tMethod(p.method as never)}
                            </span>
                            <s className="tabular-nums">{amount}</s>
                          </span>
                          <span className="text-xs">
                            {p.voidedBy
                              ? t("payment.voided", {
                                  date: formatDateTime(fmt, p.voidedAt),
                                  name: p.voidedBy.name,
                                })
                              : t("payment.voidedNoName", {
                                  date: formatDateTime(fmt, p.voidedAt),
                                })}
                          </span>
                        </li>
                      );
                    }
                    const remainingAfter = Math.max(0, remaining + p.amountCents);
                    return (
                      <li key={p.id} className="flex flex-col gap-0.5">
                        <span className="flex justify-between gap-2">
                          <span>
                            {formatDateTime(fmt, p.paidAt)} · {tMethod(p.method as never)}
                          </span>
                          <span className="font-medium tabular-nums">{amount}</span>
                        </span>
                        {canRecordPayment && invoice.status !== "VOID" && (
                          <span className="-me-2 self-end">
                            <PaymentVoidButton
                              action={voidPaymentAction.bind(null, p.id)}
                              label={t("payment.void")}
                              name={t("payment.voidName", { amount })}
                              confirmText={t("payment.voidConfirm", { amount })}
                              description={t("payment.voidDescription", {
                                remaining: formatMoney(fmt, remainingAfter, currency),
                              })}
                            />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
