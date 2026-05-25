import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listClientsPage } from "@/modules/clients/queries";
import { PageHeader } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
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
          description=""
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("firstName")}</th>
                  <th className="px-4 py-3 font-medium">{t("email")}</th>
                  <th className="px-4 py-3 font-medium">{t("phone")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {tCommon("details")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/clients/${c.id}`} className="hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <Badge variant="secondary" className="ml-2">
                        {t("petsCount", { count: c._count.pets })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/clients/${c.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {tCommon("open")} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
