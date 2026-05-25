import Link from "next/link";
import { Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listVisitsPage } from "@/modules/visits/queries";
import { VISIT_TYPES } from "@/modules/appointments/schema";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const session = await requireSession();
  const { page: pageParam, type } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, tVisitType, result] = await Promise.all([
    getTranslations("visit"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    listVisitsPage({
      clinicId: session.user.clinicId,
      type: type ?? null,
      page,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/visits/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <FilterTabs
        basePath="/visits"
        param="type"
        active={type}
        allLabel={tCommon("all")}
        options={VISIT_TYPES.map((v) => ({
          value: v,
          label: tVisitType(v),
        }))}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t("empty")}
          description=""
          action={
            <Link href="/visits/new" className={buttonVariants()}>
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
                  <th className="px-4 py-3 font-medium">{t("visitedAt")}</th>
                  <th className="px-4 py-3 font-medium">{t("type")}</th>
                  <th className="px-4 py-3 font-medium">Pet</th>
                  <th className="px-4 py-3 font-medium">{t("vet")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/visits/${v.id}`}
                        className="hover:underline"
                      >
                        {formatDateTime(v.visitedAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {tVisitType(v.type as never)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.pet.name} · {v.client.firstName} {v.client.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.vet?.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath="/visits"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ type }}
          />
        </>
      )}
    </div>
  );
}
