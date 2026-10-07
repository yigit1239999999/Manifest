import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicSettings } from "@/modules/clinics/queries";
import { invoicesForExport, paymentsForExport } from "@/modules/invoices/queries";
import { invoiceStatusesForFilter } from "@/modules/invoices/schema";
import { dayKey, dayRange, isDayKey, toDateTimeInput } from "@/lib/format";
import { csvAmount, toCsv } from "@/lib/csv";
import { ownerLabel } from "@/lib/pet-label";

/**
 * The month for the accountant (B10, job #16), as two CSV files:
 *
 * - `kind=invoices`: every invoice the list's filter shows, with subtotal,
 *   VAT rate and amount, total, paid and remaining.
 * - `kind=payments`: every payment TAKEN in the date range, by its own
 *   date, with the method -- the cash / card / transfer split is a pivot
 *   of this file, and its totals are on the list's screen.
 *
 * Same filter parameters as `/invoices`, so the export is what the screen
 * was showing. Dates are the clinic's days, written ISO so every Excel
 * reads them as dates.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.clinicId) return new Response("unauthorized", { status: 401 });
  if (!can(session.user.role, "invoices.read")) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "payments" ? "payments" : "invoices";
  const fromKey = url.searchParams.get("from");
  const toKey = url.searchParams.get("to");
  const clinic = await getClinicSettings(session.user.clinicId);
  const zone = clinic?.timezone || undefined;
  const from = isDayKey(fromKey) ? (dayRange(fromKey, zone)?.from ?? null) : null;
  const toRange = isDayKey(toKey) ? dayRange(toKey, zone) : null;
  const to = toRange ? new Date(toRange.to.getTime() + 1) : null;

  const [locale, t, tStatus, tMethod] = await Promise.all([
    getLocale(),
    getTranslations("invoice.csv"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("enum.paymentMethod"),
  ]);

  let rows: Array<Array<string | number | null>>;
  if (kind === "payments") {
    const payments = await paymentsForExport(session.user.clinicId, from, to);
    rows = [
      [t("date"), t("time"), t("number"), t("client"), t("method"), t("amount"), t("currency"), t("reference")],
      ...payments.map((p) => [
        dayKey(p.paidAt, zone),
        toDateTimeInput(p.paidAt, zone).slice(11, 16),
        p.invoice.number,
        ownerLabel(p.invoice.client),
        tMethod(p.method as never),
        csvAmount(p.amountCents, locale),
        p.invoice.currency,
        p.reference,
      ]),
    ];
  } else {
    const invoices = await invoicesForExport({
      clinicId: session.user.clinicId,
      clientId: url.searchParams.get("clientId") || null,
      statuses: invoiceStatusesForFilter(url.searchParams.get("status")),
      q: url.searchParams.get("q"),
      from,
      to,
    });
    rows = [
      [
        t("number"),
        t("date"),
        t("client"),
        t("status"),
        t("subtotal"),
        t("vatRate"),
        t("vat"),
        t("total"),
        t("paid"),
        t("remaining"),
        t("currency"),
      ],
      ...invoices.map((i) => [
        i.number,
        dayKey(i.issuedAt, zone),
        ownerLabel(i.client),
        tStatus(i.status as never),
        csvAmount(i.subtotalCents, locale),
        i.taxRate ?? "",
        csvAmount(i.taxCents, locale),
        csvAmount(i.totalCents, locale),
        i.remainingCents === null ? "" : csvAmount(Math.max(0, i.totalCents - i.remainingCents), locale),
        i.remainingCents === null ? "" : csvAmount(i.remainingCents, locale),
        i.currency,
      ]),
    ];
  }

  const range = [isDayKey(fromKey) ? fromKey : null, isDayKey(toKey) ? toKey : null].filter(Boolean).join("_");
  const name = `${kind === "payments" ? t("filePayments") : t("fileInvoices")}${range ? `-${range}` : ""}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}
