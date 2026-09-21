import Link from "next/link";
import { Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listVisitsPage } from "@/modules/visits/queries";
import { countPets } from "@/modules/pets/queries";
import { VISIT_TYPES } from "@/modules/appointments/schema";
import { MissingLink } from "@/components/missing-link";
import { PageHeader } from "@/components/page-header";
import { ownerLabel, petLabel } from "@/lib/pet-label";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; archived?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();

  // A button the server will refuse is worse than no button: the click
  // looks like it did nothing. The permission is the same one the service
  // enforces, read from one place (`lib/permissions.ts`).
  const canCreate = can(session.user.role, "visits.write");
  const { page: pageParam, type, archived } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const includeArchived = archived === "1";
  const [t, tCommon, tVisitType, tPet, result] = await Promise.all([
    getTranslations("visit"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("pet"),
    listVisitsPage({
      clinicId: session.user.clinicId,
      type: type ?? null,
      includeArchived,
      page,
    }),
  ]);

  // A visit is recorded against an animal, so on a clinic with none
  // "Yeni vizit" opens a form whose animal picker is empty. The animal
  // and not the client even when there are no clients either: this
  // screen's precondition is the animal, and `/pets/new` names the owner
  // when the reader gets there — the same chain walk `/visits/new`
  // already does. Asked only on an unfiltered empty list, so a clinic
  // with records never pays for it.
  const needsPet =
    result.items.length === 0 &&
    !type &&
    (await countPets(session.user.clinicId)) === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        {/* And not while the body is saying the link above this one is
            missing. The header's button survived the first pass and put
            two primary buttons on one screen, one of them the dead end
            the other was put there to replace. */}
        {canCreate && !needsPet && (
          <Link href="/visits/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <FilterTabs
          basePath="/visits"
          param="type"
          label={t("type")}
          active={type}
          allLabel={tCommon("all")}
          options={VISIT_TYPES.map((v) => ({
            value: v,
            label: tVisitType(v),
          }))}
          params={{ archived }}
        />
        <FilterTabs
          basePath="/visits"
          param="archived"
          label={tCommon("archiveFilter")}
          active={includeArchived ? "1" : undefined}
          allLabel={tCommon("activeOnly")}
          options={[{ value: "1", label: tCommon("withArchived") }]}
          params={{ type }}
        />
      </div>

      {result.items.length === 0 ? (
        // A filtered list with no rows is not an empty clinic. Offering
        // "New visit" here answers a question nobody asked and hides the
        // filter that is actually doing the hiding (TEAM.md #19).
        //
        // Only the type filter is asked about: "with archived" can only ever
        // widen the result, so no rows under it really does mean no visits.
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
        ) : needsPet ? (
          <MissingLink need="pet" />
        ) : (
          <EmptyState
            icon={Stethoscope}
            title={t("empty")}
            action={
              canCreate ? (
                <Link href="/visits/new" className={buttonVariants()}>
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
            rowKey={(v) => v.id}
            caption={t("title")}
            columns={[
              {
                key: "visitedAt",
                header: t("visitedAt"),
                cell: (v) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/visits/${v.id}`} className="hover:underline">
                      {formatDateTime(fmt, v.visitedAt)}
                    </Link>
                    {/* A visit is also out of the lists when its animal or
                        its client is, so all three cases carry the badge —
                        the row is hidden either way, and a row with no mark
                        on it would look like it had no reason to be here. */}
                    {(v.archivedAt || v.pet.archivedAt || v.client.archivedAt) && (
                      <StatusBadge
                        kind="archive"
                        status="archived"
                        label={tCommon("archived")}
                      />
                    )}
                  </span>
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
                  // The same question a picker asks, on a different
                  // surface: rows side by side, and the reader has to
                  // tell which Zeytin this one is. Through the shared
                  // helper rather than spelled out, so the day the
                  // format changes the list cannot disagree with the
                  // pickers about what an animal is called.
                  petLabel({ name: v.pet.name, ownerName: ownerLabel(v.client) }),
              },
              {
                key: "vet",
                header: t("vet"),
                cellClassName: "text-muted-foreground",
                cell: (v) => v.vet?.name ?? "-",
              },
              {
                key: "amount",
                header: t("amount"),
                // `numeric` carries the right alignment and
                // `tabular-nums` together, which is the whole reason
                // it exists: a money column is read down its length,
                // and proportional figures put the decimal point in a
                // different place on every row.
                numeric: true,
                cell: (v) =>
                  // Empty when there is no total, and this is the one
                  // decision in the column. `0` is an amount and means
                  // "nothing was charged"; `null` means "not entered".
                  // Printing either as the other is the cheapest way
                  // to manufacture wrong data, and a dash is no better
                  // — a dash reads as a value, which is why the charts
                  // refused one.
                  //
                  // No stand-in for a screen reader either. Reading
                  // "no amount entered" down a hundred empty cells is
                  // noise; "which visits have no total" is a filter
                  // question, not a cell's job.
                  v.totalCents === null || v.currency === null ? null : (
                    formatMoney(fmt, v.totalCents, v.currency)
                  ),
              },
            ]}
          />
          <Pagination
            basePath="/visits"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={{ type, archived }}
          />
        </>
      )}
    </div>
  );
}
