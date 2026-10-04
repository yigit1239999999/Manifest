import Link from "next/link";
import { AlertTriangle, CalendarClock, Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { telHref } from "@/lib/phone";
import { can } from "@/lib/permissions";
import { listAppointmentsPage } from "@/modules/appointments/queries";
import { APPOINTMENT_STATUSES } from "@/modules/appointments/schema";
import { countPets } from "@/modules/pets/queries";
import { MissingLink } from "@/components/missing-link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
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
import { ownerLabel } from "@/lib/pet-label";

// A day's worth of appointments fits on one screen; paging only comes back
// when the date filter is off.
const PER_DAY = 100;

/**
 * Still waiting for an outcome, and its hour has gone.
 *
 * Both halves matter and the second is why the mark still says
 * something on a past day: a closed appointment carries no mark, so
 * even on a list where every hour has passed, the marked rows are the
 * ones with work left. ux withdrew an earlier decision to suppress the
 * mark on past days after re-reading that — the mark is conditioned on
 * *open*, so it never fits every row unless every row really is open,
 * and then it is telling the truth.
 */
const OPEN_STATUSES = ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"];

/** Over, or never happened: no visit left to start from the row. */
const VISIT_CLOSED_STATUSES = ["CANCELLED", "NO_SHOW", "COMPLETED"];

function isOpenAndPast(a: { startsAt: Date; status: string }) {
  return OPEN_STATUSES.includes(a.status) && a.startsAt.getTime() < Date.now();
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; date?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();

  // A button the server will refuse is worse than no button: the click
  // looks like it did nothing. The permission is the same one the service
  // enforces, read from one place (`lib/permissions.ts`).
  const canCreate = can(session.user.role, "appointments.write");
  // The same question the appointment's own page asks before offering
  // "Start visit", and the one `/visits/new` asks before drawing it.
  const canStartVisit = can(session.user.role, "visits.write");
  const { page: pageParam, status, date: dateParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // The clinic's day, not the server's: "today" is whatever day it is at
  // the clinic right now. `?date=all` steps out of the day view entirely.
  const today = dayKey(new Date(), fmt.timeZone);
  const showAllDates = dateParam === "all";
  const date = isDayKey(dateParam) ? dateParam : today;
  const range = showAllDates ? null : dayRange(date, fmt.timeZone);

  const [t, tCommon, tPet, tType, tStatus, result] = await Promise.all([
    getTranslations("appointment"),
    getTranslations("common"),
    getTranslations("pet"),
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

  // An appointment is booked for an animal, so on a clinic with none
  // "Yeni randevu" opens a form whose animal picker is empty and says
  // nothing about why. The animal and not the client, even on a clinic
  // that has neither: this screen's own precondition is the animal, and
  // "this record belongs to a client" would be a false sentence about an
  // appointment. `/pets/new` names the next link when it comes to it,
  // which is the same chain walk `/appointments/new` already does
  // (`e2e/first-run.spec.ts`) — one screen, one true sentence.
  //
  // Asked only when the list came back empty and no status is filtering
  // it. A clinic with a day's work on the books never reaches this line.
  const needsPet =
    result.items.length === 0 &&
    !status &&
    (await countPets(session.user.clinicId)) === 0;

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
        {/* And not while the body is saying the link above this one is
            missing. The header's button survived the first pass and put
            two primary buttons on one screen, one of them the dead end
            the other was put there to replace. */}
        {canCreate && !needsPet && (
          <Link href="/appointments/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        )}
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
        label={t("status")}
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
        ) : needsPet ? (
          // A fourth piece of news, and the one a clinic sees on its
          // first morning: there is nothing to book an appointment for
          // yet. The day is not worth naming here -- no day has any --
          // so this replaces the empty-day sentence rather than sitting
          // under it.
          <MissingLink
            need="pet"
            next="/appointments"
            // The screen keeps its own voice; the missing link becomes
            // its second sentence rather than its only one. pm graded
            // this C when the gate was all there was, and graded
            // `/prescriptions` A for saying what lives on the screen.
            title={t("empty")}
            description={t("emptyHint")}
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
              canCreate ? (
                <Link href="/appointments/new" className={buttonVariants()}>
                  {t("new")}
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          {/* How many, once the row marks have said which.
              Only in single-day mode, and the reason is the one that
              killed the total row on `/visits`: "all dates" is
              paginated at 25, so a count there would not say what it
              counted — this page, or every page. A number whose scope
              is undefined is worse than none. A single day is not
              paginated, so there is no ambiguity to have. */}
          {!showAllDates &&
            (() => {
              const open = result.items.filter(isOpenAndPast).length;
              return open > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("stillOpen", { total: result.items.length, open })}
                </p>
              ) : null;
            })()}
          <DataTable
            rows={result.items}
            rowKey={(a) => a.id}
            caption={t("title")}
            // Below 512px of its own container a row becomes a two-line
            // card: time and status on top, the animal under it. At 390px
            // the table form was 17px wider than its box and cut the
            // status badge off at the edge.
            narrow="stack"
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
                    {/* An hour that has passed with nothing recorded.
                        In the time cell because the claim is about
                        time, so the eye does not have to travel to a
                        second column to assemble it — and ux's answer
                        to "can a hundred rows be scanned": text
                        aligned in one column can be, coloured marks
                        scattered across rows cannot.

                        Text, not a pill. The row already carries a
                        `StatusBadge`, and a second coloured pill would
                        have to be learnt. Not an icon either: an icon
                        needs a legend, and nobody looks one up while
                        working.

                        `text-foreground` rather than muted: this is a
                        thing to do, not an aside. Not `destructive`
                        either — an unrecorded result is missing, not
                        wrong.

                        Nothing extra for a screen reader. The words
                        are already in the accessibility tree, and the
                        one channel is the shared one. */}
                    {isOpenAndPast(a) && (
                      <span className="ms-1 text-sm font-medium text-foreground">
                        · {t("resultMissing")}
                      </span>
                    )}
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
                      {ownerLabel(a.client)}
                    </div>
                    {/* On the row, not behind a click. This is the screen
                        reception works from all morning, and "bites" read
                        after the animal is in the room is not a warning
                        (TEAM.md #20). Not a `Callout`: it belongs to one
                        row, and eight boxed warnings would turn a day plan
                        into a wall of amber. */}
                    {a.pet.alerts && (
                      <div className="mt-1 flex items-start gap-1 text-xs font-medium text-warning">
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {/* The colour and the icon say "warning" to
                              people who can see them; this says it to
                              everyone else. */}
                          <span className="sr-only">{tPet("alerts")}: </span>
                          {a.pet.alerts}
                        </span>
                      </div>
                    )}
                    {/* The columns hidden on a phone still matter, so the
                        essentials ride along in this cell.

                        Each rides until its own column arrives, which is
                        not the same moment for both: the type column
                        appears at `sm`, the phone column at `md`. This
                        block used to disappear as one at `sm`, so between
                        640 and 767 — a tablet held upright — the phone
                        was in neither place. A stand-in has to be hidden
                        on exactly the breakpoint of the thing it stands
                        in for, column by column, or it leaves a hole
                        instead of a duplicate. */}
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground md:hidden">
                      <span className="sm:hidden">
                        {tType(a.type as never)}
                      </span>
                      {a.client.phone &&
                        (telHref(a.client.phone) ? (
                          <a
                            href={telHref(a.client.phone) ?? undefined}
                            className="whitespace-nowrap hover:underline"
                          >
                            {a.client.phone}
                          </a>
                        ) : (
                          // Not dialable, so not a link: something that
                          // looks tappable and does nothing is worse than
                          // plain text.
                          <span className="whitespace-nowrap">{a.client.phone}</span>
                        ))}
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
                stack: "end",
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
                // A phone number is one token; see `/clients`.
                cellClassName: "whitespace-nowrap",
                cell: (a) => {
                  const dial = telHref(a.client.phone);
                  if (!a.client.phone)
                    return <span className="text-muted-foreground">-</span>;
                  return dial ? (
                    <a
                      href={dial}
                      className="text-muted-foreground hover:underline"
                    >
                      {a.client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {a.client.phone}
                    </span>
                  );
                },
              },
              // The day plan is where reception sees the animal arrive,
              // so the visit starts from the row rather than one page
              // further in. Not for an appointment that is over, and
              // not for one that never happened: neither has a visit to
              // start. Stacked, it takes the second line's end, across
              // from the animal it is for.
              ...(canStartVisit
                ? [
                    {
                      key: "startVisit",
                      header: t("startVisit"),
                      headerHidden: true,
                      align: "end" as const,
                      stack: "meta-end" as const,
                      cell: (a: (typeof result.items)[number]) =>
                        VISIT_CLOSED_STATUSES.includes(a.status) ? null : (
                          <Link
                            href={`/visits/new?${new URLSearchParams({
                              petId: a.pet.id,
                              type: a.type,
                              appointmentId: a.id,
                            })}`}
                            aria-label={tCommon("actionFor", {
                              action: t("startVisit"),
                              subject: a.pet.name,
                            })}
                            // Free to wrap in the table, the one column
                            // added to a row that was already six wide;
                            // stacked, `meta-end` keeps it on one line.
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Stethoscope className="size-3.5 shrink-0" aria-hidden="true" />
                            {t("startVisit")}
                          </Link>
                        ),
                    },
                  ]
                : []),
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
