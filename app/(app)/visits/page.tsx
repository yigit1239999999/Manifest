import Link from "next/link";
import { Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { listVisitsPage } from "@/modules/visits/queries";
import { VISIT_TYPES } from "@/modules/appointments/schema";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();
  const { page: pageParam, type } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, tVisitType, tPet, result] = await Promise.all([
    getTranslations("visit"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("pet"),
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
        // A filtered list with no rows is not an empty clinic. Offering
        // "New visit" here answers a question nobody asked and hides the
        // filter that is actually doing the hiding (TEAM.md #19).
        type ? (
          <EmptyState
            icon={Stethoscope}
            title={tCommon("emptyFiltered")}
            description={tCommon("emptyFilteredHint")}
            action={
              <Link
                href="/visits"
                className={buttonVariants({ variant: "secondary" })}
              >
                {tCommon("clearFilter")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Stethoscope}
            title={t("empty")}
            action={
              <Link href="/visits/new" className={buttonVariants()}>
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
            rowKey={(v) => v.id}
            caption={t("title")}
            columns={[
              {
                key: "visitedAt",
                header: t("visitedAt"),
                cell: (v) => (
                  <Link href={`/visits/${v.id}`} className="hover:underline">
                    {formatDateTime(fmt, v.visitedAt)}
                  </Link>
                ),
              },
              {
                key: "type",
                header: t("type"),
                cell: (v) => (
                  <Badge>{tVisitType(v.type as never)}</Badge>
                ),
              },
              {
                key: "pet",
                // Was the hardcoded English string "Pet".
                header: tPet("one"),
                cellClassName: "text-muted-foreground",
                cell: (v) =>
                  `${v.pet.name} · ${v.client.firstName} ${v.client.lastName}`,
              },
              {
                key: "vet",
                header: t("vet"),
                cellClassName: "text-muted-foreground",
                cell: (v) => v.vet?.name ?? "-",
              },
            ]}
          />
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
