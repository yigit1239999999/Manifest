import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listInvoicesPage } from "@/modules/invoices/queries";
import {
  INVOICE_STATUSES,
  UNPAID_FILTER,
  invoiceStatusesForFilter,
} from "@/modules/invoices/schema";
import { countClients } from "@/modules/clients/queries";
import { MissingLink } from "@/components/missing-link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();

  // A button the server will refuse is worse than no button: the click
  // looks like it did nothing. The permission is the same one the service
  // enforces, read from one place (`lib/permissions.ts`).
  const canCreate = can(session.user.role, "invoices.write");
  const { page: pageParam, status: statusParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  // `unpaid` is two statuses, SENT and PARTIAL: the dashboard's
  // outstanding tile links here with it. A value that names nothing is
  // dropped, so it neither selects a tab nor claims the list is filtered.
  const statuses = invoiceStatusesForFilter(statusParam);
  const status = statuses ? statusParam : undefined;
  const [t, tCommon, tStatus, tClient, result] = await Promise.all([
    getTranslations("invoice"),
    getTranslations("common"),
    getTranslations("enum.invoiceStatus"),
    getTranslations("client"),
    listInvoicesPage({
      clinicId: session.user.clinicId,
      statuses,
      page,
    }),
  ]);

  // An invoice is raised against a client and nothing more: the line
  // items may name an animal, but only when the bill came from a visit,
  // and the field is optional (`components/forms/invoice-form.tsx`). So
  // this screen's precondition is one link, not two -- sending a vet to
  // `/pets/new` here would be a detour on the way to a form that never
  // asked for an animal. Asked only on an unfiltered empty list.
  const needsClient =
    result.items.length === 0 &&
    !status &&
    (await countClients(session.user.clinicId)) === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        {/* And not while the body is saying the link above this one is
            missing. The header's button survived the first pass and put
            two primary buttons on one screen, one of them the dead end
            the other was put there to replace. */}
        {canCreate && !needsClient && (
          <Link href="/invoices/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        )}
      </PageHeader>

      <FilterTabs
        basePath="/invoices"
        param="status"
        label={t("status")}
        active={status}
        allLabel={tCommon("all")}
        // First after "all": "who has not paid?" is the question this
        // list is opened with at the end of the day.
        options={[
          { value: UNPAID_FILTER, label: t("unpaid") },
          ...INVOICE_STATUSES.map((s) => ({
            value: s,
            label: tStatus(s),
          })),
        ]}
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
        ) : needsClient ? (
          <MissingLink
            need="client"
            next="/invoices"
            title={t("empty")}
            description={t("emptyHint")}
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title={t("empty")}
            // The same sentence the gated version above shows, because
            // it is one fact about the screen and not two: an invoice
            // is issued to a client, and this is where they collect.
            description={t("emptyHint")}
            action={
              canCreate ? (
                <Link href="/invoices/new" className={buttonVariants()}>
                  <Plus />
                  {t("new")}
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <DataTable
            rows={result.items}
            rowKey={(inv) => inv.id}
            caption={t("title")}
            // On a phone the total and the status were the two columns
            // past the edge of the screen. Stacked, the total shares the
            // first line with the number and the status closes the
            // second, both at the end edge.
            narrow="stack"
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
                cell: (inv) => ownerLabel(inv.client),
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
                numeric: true,
                cellClassName: "font-medium",
                cell: (inv) => formatMoney(fmt, inv.totalCents, inv.currency),
              },
              {
                key: "remaining",
                header: t("remaining"),
                numeric: true,
                // Stacked, the total already holds the first line's end
                // and the headers are off-screen, so a second bare amount
                // could be either. It names itself there, and only when
                // something is owed: a paid row's zero is noise on a phone.
                stack: "meta",
                cell: (inv) =>
                  inv.remainingCents ? (
                    <span className="font-medium">
                      <span className="hidden @max-lg:inline">
                        {t("remaining")}{" "}
                      </span>
                      {formatMoney(fmt, inv.remainingCents, inv.currency)}
                    </span>
                  ) : (
                    // Null is a voided invoice: it owes nothing, but it
                    // was never settled either, so it is not a zero.
                    <span className="text-muted-foreground @max-lg:hidden">
                      {inv.remainingCents === null
                        ? "-"
                        : formatMoney(fmt, 0, inv.currency)}
                    </span>
                  ),
              },
              {
                key: "status",
                header: t("status"),
                stack: "meta-end",
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
