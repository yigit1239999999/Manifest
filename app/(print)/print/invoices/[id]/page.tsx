import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { getInvoiceById } from "@/modules/invoices/queries";
import { getClinicLetterhead } from "@/modules/clinics/queries";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { invoiceLineText } from "@/components/invoices/line-text";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";
import { vetWithTitle } from "@/lib/vet-title";

/**
 * An invoice as paper: what the owner takes home, and with the payments
 * on it, their receipt.
 *
 * Everything the vet named as missing (job #17): the clinic and how to
 * reach it, the vet with their title, the client, the animal, each line,
 * the totals with the VAT rate, what has been paid and how, and what is
 * left. In the reader's language, the way the screen draws it.
 */
export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session, fmt] = await Promise.all([params, requireSession(), getFormatContext()]);
  const [invoice, clinic, t, tStatus, tMethod, tKind, tVisitType] = await Promise.all([
    getInvoiceById(session.user.clinicId, id),
    getClinicLetterhead(session.user.clinicId),
    getTranslations("invoice"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("enum.paymentMethod"),
    getTranslations("enum.invoiceLineKind"),
    getTranslations("enum.visitType"),
  ]);
  if (!invoice || !clinic) notFound();

  const currency = invoice.currency;
  const money = (cents: number) => formatMoney(fmt, cents, currency);
  const payments = invoice.payments.filter((p) => !p.voidedAt);
  const paid = payments.reduce((s, p) => s + p.amountCents, 0);
  const remaining = invoice.status === "VOID" ? 0 : Math.max(0, invoice.totalCents - paid);
  const pets = [...new Set(invoice.lines.flatMap((l) => (l.pet ? [l.pet.name] : [])))];
  const vet = invoice.lines.find((l) => l.visit?.vet)?.visit?.vet ?? null;
  const words = {
    kind: (kind: Parameters<typeof tKind>[0]) => tKind(kind),
    visitType: (type: string) => tVisitType(type as never),
    date: (date: Date) => formatDate(fmt, date),
  };
  const clinicAddress = [clinic.address, [clinic.postalCode, clinic.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PrintToolbar backHref={`/invoices/${invoice.id}`} backLabel={t("print.back")} printLabel={t("print.button")} />
      <article className="flex flex-col gap-8 text-sm">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-xl font-semibold">{clinic.name}</h1>
            {clinicAddress && <p className="text-muted-foreground">{clinicAddress}</p>}
            {(clinic.phone || clinic.email) && (
              <p className="text-muted-foreground">{[clinic.phone, clinic.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 text-end">
            <p className="text-lg font-semibold uppercase tracking-wide">{t("print.title")}</p>
            <p className="tabular-nums">{t("print.number", { number: invoice.number })}</p>
            <p className="text-muted-foreground">{t("print.issued", { date: formatDate(fmt, invoice.issuedAt) })}</p>
            {invoice.dueAt && (
              <p className="text-muted-foreground">{t("print.due", { date: formatDate(fmt, invoice.dueAt) })}</p>
            )}
            <p className="font-medium">{tStatus(invoice.status as never)}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.billedTo")}</p>
            <p className="font-medium">{ownerLabel(invoice.client)}</p>
            {invoice.client.phone && <p>{invoice.client.phone}</p>}
            {invoice.client.address && <p className="text-muted-foreground">{invoice.client.address}</p>}
          </div>
          {pets.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.animal")}</p>
              <p className="font-medium">{pets.join(", ")}</p>
            </div>
          )}
          {vet && (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.vet")}</p>
              <p className="font-medium">{vetWithTitle(vet.name, vet.role, fmt.locale)}</p>
            </div>
          )}
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pe-2 text-start font-medium">{t("description")}</th>
              <th className="px-2 py-2 text-end font-medium">{t("quantity")}</th>
              <th className="px-2 py-2 text-end font-medium">{t("unitPrice")}</th>
              <th className="py-2 ps-2 text-end font-medium">{t("lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-border/60 align-top">
                <td className="break-words py-2 pe-2">{invoiceLineText(l, words)}</td>
                <td className="px-2 py-2 text-end tabular-nums">{l.quantity}</td>
                <td className="px-2 py-2 text-end tabular-nums">{money(l.unitPriceCents)}</td>
                <td className="py-2 ps-2 text-end tabular-nums">{money(l.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ms-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd className="text-end tabular-nums">{money(invoice.subtotalCents)}</dd>
          <dt className="text-muted-foreground">
            {invoice.taxRate !== null ? t("taxAt", { rate: invoice.taxRate }) : t("tax")}
          </dt>
          <dd className="text-end tabular-nums">{money(invoice.taxCents)}</dd>
          <dt className="border-t border-border pt-1.5 font-semibold">{t("total")}</dt>
          <dd className="border-t border-border pt-1.5 text-end font-semibold tabular-nums">{money(invoice.totalCents)}</dd>
          {paid > 0 && (
            <>
              <dt className="text-muted-foreground">{t("paidTotal")}</dt>
              <dd className="text-end tabular-nums">{money(paid)}</dd>
            </>
          )}
          {invoice.status !== "VOID" && invoice.status !== "DRAFT" && (
            <>
              <dt className="font-semibold">{t("remaining")}</dt>
              <dd className="text-end font-semibold tabular-nums">{money(remaining)}</dd>
            </>
          )}
        </dl>

        {payments.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.payments")}</h2>
            <ul className="flex flex-col gap-1">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-4">
                  <span>
                    {formatDateTime(fmt, p.paidAt)} · {tMethod(p.method as never)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="tabular-nums">{money(p.amountCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invoice.notes && <p className="whitespace-pre-line rounded-control bg-muted/40 p-3">{invoice.notes}</p>}

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("print.printedAt", { date: formatDateTime(fmt, new Date()) })}
        </footer>
      </article>
    </>
  );
}
