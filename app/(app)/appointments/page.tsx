import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { listAppointmentsPage } from "@/modules/appointments/queries";
import { APPOINTMENT_STATUSES } from "@/modules/appointments/schema";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { FilterTabs } from "@/components/filter-tabs";
import { DayNav } from "@/components/day-nav";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import {
  dayKey,
  dayRange,
  formatDate,
  formatDayHeading,
  formatDuration,
  formatTime,
  isDayKey,
  shiftDayKey,
} from "@/lib/format";

// A day's worth of appointments fits on one screen; paging only comes back
// when the date filter is off.
const PER_DAY = 100;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; date?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();
  const { page: pageParam, status, date: dateParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // The clinic's day, not the server's: "today" is whatever day it is at
  // the clinic right now. `?date=all` steps out of the day view entirely.
  const today = dayKey(new Date(), fmt.timeZone);
  const showAllDates = dateParam === "all";
  const date = isDayKey(dateParam) ? dateParam : today;
  const range = showAllDates ? null : dayRange(date, fmt.timeZone);

  const [t, tCommon, tType, tStatus, result] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("enum.appointmentStatus"),
    listAppointmentsPage({
      clinicId: session.user.clinicId,
      statuses: status ? [status] : null,
      from: range?.from ?? null,
      to: range?.to ?? null,
      page,
      perPage: showAllDates ? undefined : PER_DAY,
    }),
  ]);

  // Every link keeps the other filter, so the day and the status work
  // together rather than resetting each other.
  const hrefFor = (params: { date?: string | null; status?: string | null }) => {
    const query = new URLSearchParams();
    const nextDate = params.date === undefined ? (showAllDates ? "all" : date) : params.date;
    const nextStatus = params.status === undefined ? status : params.status;
    if (nextDate) query.set("date", nextDate);
    if (nextStatus) query.set("status", nextStatus);
    const qs = query.toString();
    return qs ? `/appointments?${qs}` : "/appointments";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/appointments/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      <DayNav
        date={showAllDates ? "" : date}
        previousDate={shiftDayKey(date, -1)}
        nextDate={shiftDayKey(date, 1)}
        todayDate={today}
        label={showAllDates ? t("allDates") : formatDayHeading(fmt, range?.from)}
        // `null` from the nav means "every date", which the URL spells out.
        href={(value) => hrefFor({ date: value ?? "all" })}
        labels={{
          previous: t("previousDay"),
          next: t("nextDay"),
          today: t("today"),
          allDates: t("allDates"),
        }}
      />

      <FilterTabs
        basePath="/appointments"
        param="status"
        active={status}
        allLabel={tCommon("all")}
        params={{ date: showAllDates ? "all" : date }}
        options={APPOINTMENT_STATUSES.map((s) => ({
          value: s,
          label: tStatus(s),
        }))}
      />

      {result.items.length === 0 ? (
        // Three different pieces of news, and they were one before: no
        // appointments at all, none on the day being looked at, and none
        // matching the status filter. The last one used to offer "Book an
        // appointment", which is not what someone filtering by "No-show"
        // is asking for (TEAM.md #19).
        status ? (
          <EmptyState
            icon={CalendarClock}
            title={tCommon("emptyFiltered")}
            description={tCommon("emptyFilteredHint")}
            action={
              <Link
                href={hrefFor({ status: null })}
                className={buttonVariants({ variant: "secondary" })}
              >
                {tCommon("clearFilter")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={CalendarClock}
            title={
              showAllDates
                ? t("empty")
                : t("emptyDay", { date: formatDate(fmt, range?.from) })
            }
            description={showAllDates ? t("emptyHint") : t("emptyDayHint")}
            action={
              <Link href="/appointments/new" className={buttonVariants()}>
                {t("new")}
              </Link>
            }
          />
        )
      ) : (
        <>
          <DataTable
            rows={result.items}
            rowKey={(a) => a.id}
            caption={t("title")}
            columns={[
              {
                key: "startsAt",
                header: t("startsAt"),
                cell: (a) => (
                  <>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {showAllDates
                        ? `${formatDate(fmt, a.startsAt)} ${formatTime(fmt, a.startsAt)}`
                        : formatTime(fmt, a.startsAt)}
                    </Link>
                    {a.durationMinutes != null && (
                      <div className="text-xs text-muted-foreground">
                        {formatDuration(fmt, a.durationMinutes)}
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: "petClient",
                header: t("petClient"),
                cell: (a) => (
                  <>
                    <div className="font-medium text-foreground">{a.pet.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.client.firstName} {a.client.lastName}
                    </div>
                    {/* The columns hidden on a phone still matter, so the
                        essentials ride along in this cell. */}
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground sm:hidden">
                      <span>{tType(a.type as never)}</span>
                      {a.client.phone && (
                        <a href={`tel:${a.client.phone}`} className="hover:underline">
                          {a.client.phone}
                        </a>
                      )}
                    </div>
                  </>
                ),
              },
              {
                key: "type",
                header: t("type"),
                hideBelow: "sm",
                cell: (a) => (
                  <Badge>{tType(a.type as never)}</Badge>
                ),
              },
              {
                key: "status",
                header: t("status"),
                cell: (a) => (
                  <StatusBadge
                    kind="appointment"
                    status={a.status}
                    label={tStatus(a.status as never)}
                  />
                ),
              },
              {
                key: "vet",
                header: t("vet"),
                hideBelow: "md",
                cellClassName: "text-muted-foreground",
                cell: (a) => a.vet?.name ?? "-",
              },
              {
                key: "phone",
                header: t("phone"),
                hideBelow: "md",
                cell: (a) =>
                  a.client.phone ? (
                    <a
                      href={`tel:${a.client.phone}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {a.client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  ),
              },
            ]}
          />
          {showAllDates && (
            <Pagination
              basePath="/appointments"
              total={result.total}
              page={result.page}
              perPage={result.perPage}
              params={{ status, date: "all" }}
            />
          )}
        </>
      )}
    </div>
  );
}
