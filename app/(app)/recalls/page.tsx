import Link from "next/link";
import { CalendarCheck, CalendarPlus, Syringe } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";
import { SPECIES } from "@/modules/pets/schema";
import { newAppointmentHref } from "@/modules/appointments/prefill";
import {
  countOverdueVaccinations,
  countUpcomingVaccinations,
  UPCOMING_WINDOW_DAYS,
} from "@/modules/vaccinations/queries";
import {
  listRecalls,
  parseRecallFilters,
  recallVaccineOptions,
  type RecallRow,
} from "@/modules/vaccinations/recall";
import {
  deleteRecallContactAction,
  recallMessagesAction,
  recordRecallContactAction,
} from "@/modules/vaccinations/recall-actions";
import { setVaccinationDueDismissedAction } from "@/modules/vaccinations/actions";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { PhoneLink } from "@/components/phone-link";
import { RecallFilters } from "@/components/recall-filters";
import { RecallCopyButton } from "@/components/recall-copy-button";
import { RecallContactButtons } from "@/components/recall-contact-buttons";
import { VaccinationDueDismissButton } from "@/components/vaccination-due-dismiss-button";

type Search = {
  view?: string;
  age?: string;
  vaccine?: string;
  species?: string;
  contact?: string;
  sort?: string;
  page?: string;
};

/**
 * The recall list: every animal whose vaccination has come due, or will
 * within the month, and the three things the front desk does about each
 * one -- ring, book, or take it off the list.
 *
 * The dashboard card shows five rows and the count; this is where the
 * count leads (pm B1). It is shaped after the recall worklists of the
 * practice systems clinics move from (ezyVet's reminders list, Vetspire's
 * "Due" view): one row per due vaccine, the owner's number on the row,
 * what has been tried and by whom, and booked animals out of the way.
 */
export default async function RecallsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const filters = parseRecallFilters(raw);
  const page = Math.max(1, Number(raw.page) || 1);
  const clinicId = session.user.clinicId;
  const now = new Date();

  const [t, tCommon, tSpecies, fmt, result, vaccines, overdueTotal, upcomingTotal] =
    await Promise.all([
      getTranslations("recall"),
      getTranslations("common"),
      getTranslations("enum.species"),
      getFormatContext(),
      listRecalls({ ...filters, clinicId, page, now }),
      recallVaccineOptions({ ...filters, clinicId, now }),
      countOverdueVaccinations(clinicId, now),
      countUpcomingVaccinations(clinicId, now),
    ]);

  const canBook = can(session.user.role, "appointments.write");
  // No guard on the call marks or the copy: every role can make a call
  // (`reminders.write`), and the service still checks.
  const canDismiss = can(session.user.role, "vaccinations.write");
  const filtered = Boolean(
    filters.vaccine ||
      filters.species ||
      filters.contact ||
      (filters.view === "overdue" && filters.age !== "recent"),
  );

  const params = {
    view: filters.view === "overdue" ? undefined : filters.view,
    age: raw.age,
    vaccine: raw.vaccine,
    species: raw.species,
    contact: raw.contact,
    sort: raw.sort,
  };
  const number = (n: number) => new Intl.NumberFormat(fmt.locale).format(n);

  const tabs = [
    { view: "overdue", label: t("tabs.overdue"), count: overdueTotal },
    {
      view: "upcoming",
      label: t("tabs.upcoming", { days: UPCOMING_WINDOW_DAYS }),
      count: upcomingTotal,
    },
  ] as const;

  const subject = (r: RecallRow) => `${r.petName} · ${r.name}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle", { days: UPCOMING_WINDOW_DAYS })}>
        {result.total > 0 && (
          <RecallCopyButton
            build={recallMessagesAction.bind(null, {
              view: filters.view,
              age: filters.age,
              vaccine: filters.vaccine ?? undefined,
              species: filters.species ?? undefined,
              contact: filters.contact ?? undefined,
              sort: filters.sort,
            })}
          />
        )}
      </PageHeader>

      <nav aria-label={t("tabs.label")} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const active = filters.view === tab.view;
          return (
            <Link
              key={tab.view}
              href={tab.view === "overdue" ? "/recalls" : `/recalls?view=${tab.view}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="rounded-pill bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {number(tab.count)}
              </span>
            </Link>
          );
        })}
      </nav>

      <RecallFilters
        view={filters.view}
        vaccines={vaccines.map((v) => ({ value: v.name, label: `${v.name} (${number(v.count)})` }))}
        species={SPECIES.map((s) => ({ value: s, label: tSpecies(s) }))}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title={filtered ? tCommon("emptyFiltered") : t(`empty.${filters.view}`)}
          description={filtered ? tCommon("emptyFilteredHint") : t(`emptyHint.${filters.view}`)}
          action={
            filtered ? (
              <Link
                href={filters.view === "overdue" ? "/recalls" : `/recalls?view=${filters.view}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {tCommon("clearFilter")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("total", { count: result.total })} {t("bookedLast")}
          </p>
          <DataTable
            rows={result.items}
            rowKey={(r) => r.id}
            caption={t("title")}
            narrow="stack"
            columns={[
              {
                key: "pet",
                header: t("columns.pet"),
                stack: "title",
                cell: (r) => (
                  <>
                    <Link href={`/pets/${r.petId}`} className="font-medium text-foreground hover:underline">
                      {r.petName}
                    </Link>
                    <span className="text-xs text-muted-foreground"> · {tSpecies(r.species as never)}</span>
                    <div className="text-sm text-foreground">{r.name}</div>
                  </>
                ),
              },
              {
                key: "owner",
                header: t("columns.owner"),
                stack: "meta",
                cell: (r) => (
                  <>
                    <Link href={`/clients/${r.ownerId}`} className="hover:underline">
                      {ownerLabel({ firstName: r.ownerFirstName, lastName: r.ownerLastName })}
                    </Link>
                    <div>
                      {r.ownerPhone ? (
                        <PhoneLink phone={r.ownerPhone} className="text-sm text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("noPhone")}</span>
                      )}
                    </div>
                  </>
                ),
              },
              {
                key: "due",
                header: t("columns.due"),
                stack: "meta",
                cellClassName: "whitespace-nowrap",
                cell: (r) => (
                  <>
                    <div className="tabular-nums">{formatDate(fmt, r.nextDueAt)}</div>
                    <div
                      className={cn(
                        "text-xs",
                        r.nextDueAt < now ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {relativeTime(fmt, r.nextDueAt)}
                    </div>
                  </>
                ),
              },
              {
                key: "state",
                header: t("columns.state"),
                stack: "meta",
                cell: (r) => (
                  <div className="flex flex-col items-start gap-1">
                    {r.apptId && r.apptStartsAt && (
                      <Link href={`/appointments/${r.apptId}`} className="hover:underline">
                        <Badge variant="primary">
                          <CalendarCheck className="size-3.5" aria-hidden="true" />
                          {t("booked", { when: formatDateTime(fmt, r.apptStartsAt) })}
                        </Badge>
                      </Link>
                    )}
                    {r.lastOutcome && r.lastContactAt && (
                      <span
                        className={cn(
                          "text-xs",
                          r.lastOutcome === "UNREACHABLE" ? "font-medium text-warning" : "text-muted-foreground",
                        )}
                      >
                        {t(r.lastOutcome === "CALLED" ? "lastCalled" : "lastUnreachable", {
                          count: r.contactCount,
                          who: r.lastContactBy ?? t("someone"),
                          when: formatDateTime(fmt, r.lastContactAt),
                        })}
                      </span>
                    )}
                    {!r.apptId && !r.lastOutcome && (
                      <span className="text-xs text-muted-foreground">{t("notTried")}</span>
                    )}
                  </div>
                ),
              },
              {
                key: "actions",
                header: t("columns.actions"),
                headerHidden: true,
                // Its own line on a narrow screen: four controls beside
                // the animal's name pushed the last one off the card.
                stack: "meta",
                cellClassName: "@max-lg:basis-full",
                cell: (r) => (
                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    <RecallContactButtons
                      record={recordRecallContactAction.bind(null, r.id)}
                      remove={deleteRecallContactAction}
                      labels={{
                        called: t("called"),
                        unreachable: t("unreachable"),
                        calledFor: tCommon("actionFor", { action: t("called"), subject: subject(r) }),
                        unreachableFor: tCommon("actionFor", {
                          action: t("unreachable"),
                          subject: subject(r),
                        }),
                        markedCalled: t("markedCalled", { pet: r.petName }),
                        markedUnreachable: t("markedUnreachable", { pet: r.petName }),
                        undo: t("undo"),
                      }}
                    />
                    {canBook && !r.apptId && (
                      <Link
                        href={newAppointmentHref({ petId: r.petId, type: "VACCINATION", reason: r.name })}
                        aria-label={tCommon("actionFor", { action: t("book"), subject: subject(r) })}
                        className="inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-xs font-medium text-primary hover:bg-muted"
                      >
                        <CalendarPlus className="size-4" aria-hidden="true" />
                        {t("book")}
                      </Link>
                    )}
                    {canDismiss && (
                      <VaccinationDueDismissButton
                        action={setVaccinationDueDismissedAction.bind(null, r.id)}
                        label={t("dismiss")}
                        name={tCommon("actionFor", { action: t("dismiss"), subject: subject(r) })}
                        undoLabel={t("undo")}
                        undoneLabel={t("dismissed")}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            basePath="/recalls"
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            params={params}
          />
          {canDismiss && (
            <p className="text-xs text-muted-foreground">{t("dismissExplained")}</p>
          )}
        </>
      )}
    </div>
  );
}
