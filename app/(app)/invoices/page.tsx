import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listInvoicesPage } from "@/modules/invoices/queries";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await requireSession();
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, tStatus, result, currency] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.invoiceStatus"),
    listInvoicesPage({
      clinicId: session.user.clinicId,
      statuses: status ? [status] : null,
      page,
    }),
    getClinicCurrency(session.user.clinicId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/invoices/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <FilterTabs
        basePath="/invoices"
        param="status"
        active={status}
        allLabel={tCommon("all")}
        options={INVOICE_STATUSES.map((s) => ({
          value: s,
          label: tStatus(s),
        }))}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("empty")}
          description=""
          action={
            <Link href="/invoices/new" className={buttonVariants()}>
              <Plus />
              {t("new")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("number")}</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">{t("issuedAt")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("total")}
                  </th>
                  <th className="px-4 py-3 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="hover:underline"
                      >
                        #{inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.client.firstName} {inv.client.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.issuedAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(inv.totalCents, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {tStatus(inv.status as never)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath="/invoices"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ status }}
          />
        </>
      )}
    </div>
  );
}
