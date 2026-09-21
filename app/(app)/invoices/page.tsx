import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { listInvoicesPage } from "@/modules/invoices/queries";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, tStatus, tClient, result] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("client"),
    listInvoicesPage({
      clinicId: session.user.clinicId,
      statuses: status ? [status] : null,
      page,
    }),
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
        // See the same branch in /visits: "no unpaid invoices" and "no
        // invoices at all" are opposite pieces of news (TEAM.md #19).
        status ? (
          <EmptyState
            icon={Receipt}
            title={tCommon("emptyFiltered")}
            description={tCommon("emptyFilteredHint")}
            action={
              <Link
                href="/invoices"
                className={buttonVariants({ variant: "secondary" })}
              >
                {tCommon("clearFilter")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title={t("empty")}
            action={
              <Link href="/invoices/new" className={buttonVariants()}>
                <Plus />
                {t("new")}
              </Link>
            }
          />
        )
      ) : (
        <>
          <DataTable
            rows={result.items}
            rowKey={(inv) => inv.id}
            caption={t("title")}
            columns={[
              {
                key: "number",
                header: t("number"),
                cellClassName: "font-medium",
                cell: (inv) => (
                  <Link href={`/invoices/${inv.id}`} className="hover:underline">
                    #{inv.number}
                  </Link>
                ),
              },
              {
                key: "client",
                // Was the hardcoded English string "Client".
                header: tClient("one"),
                cellClassName: "text-muted-foreground",
                cell: (inv) => `${inv.client.firstName} ${inv.client.lastName}`,
              },
              {
                key: "issuedAt",
                header: t("issuedAt"),
                cellClassName: "text-muted-foreground",
                cell: (inv) => formatDate(fmt, inv.issuedAt),
              },
              {
                key: "total",
                header: t("total"),
                align: "end",
                cellClassName: "font-medium",
                cell: (inv) => formatMoney(fmt, inv.totalCents, inv.currency),
              },
              {
                key: "status",
                header: t("status"),
                cell: (inv) => (
                  <StatusBadge
                    kind="invoice"
                    status={inv.status}
                    label={tStatus(inv.status as never)}
                  />
                ),
              },
            ]}
          />
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
