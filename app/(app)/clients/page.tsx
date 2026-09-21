import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listClientsPage } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireSession();
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, result] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
    listClientsPage({
      clinicId: session.user.clinicId,
      search: q ?? null,
      page,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/clients/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <SearchForm action="/clients" placeholder={t("search")} defaultValue={q} />

      {result.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? t("emptySearch") : t("empty")}
          description={q ? t("emptySearchHint") : t("emptyHint")}
        />
      ) : (
        <>
          <DataTable
            rows={result.items}
            rowKey={(c) => c.id}
            caption={t("title")}
            columns={[
              {
                key: "name",
                header: t("firstName"),
                cellClassName: "font-medium text-foreground",
                cell: (c) => (
                  <>
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <Badge className="ms-2">
                      {t("petsCount", { count: c._count.pets })}
                    </Badge>
                  </>
                ),
              },
              {
                key: "email",
                header: t("email"),
                cellClassName: "text-muted-foreground",
                cell: (c) => c.email ?? "-",
              },
              {
                key: "phone",
                header: t("phone"),
                cellClassName: "text-muted-foreground",
                cell: (c) => c.phone ?? "-",
              },
              {
                key: "open",
                header: tCommon("details"),
                align: "end",
                cell: (c) => (
                  <Link
                    href={`/clients/${c.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {tCommon("open")} →
                  </Link>
                ),
              },
            ]}
          />
          <Pagination
            basePath="/clients"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ q }}
          />
        </>
      )}
    </div>
  );
}
