import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listAppointmentsPage } from "@/modules/appointments/queries";
import { APPOINTMENT_STATUSES } from "@/modules/appointments/schema";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await requireSession();
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [t, tCommon, tType, tStatus, result] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("enum.appointmentStatus"),
    listAppointmentsPage({
      clinicId: session.user.clinicId,
      statuses: status ? [status] : null,
      page,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/appointments/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <FilterTabs
        basePath="/appointments"
        param="status"
        active={status}
        allLabel={tCommon("all")}
        options={APPOINTMENT_STATUSES.map((s) => ({
          value: s,
          label: tStatus(s),
        }))}
      />

      {result.items.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty")} description="" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("startsAt")}</th>
                  <th className="px-4 py-3 font-medium">Pet · Client</th>
                  <th className="px-4 py-3 font-medium">{t("type")}</th>
                  <th className="px-4 py-3 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/appointments/${a.id}`}
                        className="hover:underline"
                      >
                        {formatDateTime(a.startsAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {a.pet.name} · {a.client.firstName} {a.client.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{tType(a.type as never)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {tStatus(a.status as never)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath="/appointments"
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
