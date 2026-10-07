import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ArrivalButtons } from "@/components/arrival-buttons";
import { PhoneLink } from "@/components/phone-link";
import { formatDayHeading, formatTime, type FormatContext } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";
import { cn } from "@/lib/utils";
import { setArrivalAction, undoArrivalAction } from "@/modules/appointments/arrival-actions";
import type { TodayAppointment } from "@/modules/dashboard/queries";

/** Still waiting for the animal: the rows that carry the one-tap outcomes. */
const WAITING = new Set(["SCHEDULED", "CONFIRMED"]);
/** The day is over for these rows; they stay, quieter, so the day reads whole. */
const SETTLED = new Set(["COMPLETED", "NO_SHOW"]);

/**
 * The top of the dashboard: who is coming today, who is here, and the one
 * thing to do about each of them.
 *
 * It replaced nothing -- "Yaklaşan randevular" stays below as the plan for
 * the days after -- but it is the reason the page is opened at 08:45. The
 * shape follows the front-desk screen of the clinic systems vets already
 * use (ezyVet's "Today" whiteboard, Covetrus Pulse's day view): one line
 * per appointment, in time order, status in words, the action on the row.
 *
 * Arrived and in-progress animals stay in place. The plan card dropped a
 * row the moment its hour passed or the animal came in, so the patient in
 * the waiting room was exactly the one the dashboard stopped showing.
 *
 * A "now" line sits between the hours that have passed and those to
 * come, read from the clinic's clock and drawn only when both sides have
 * rows: on a day that is all ahead or all behind it would say nothing.
 */
export async function TodayStrip({
  items,
  fmt,
  now,
  dayStart,
  canMark,
  canStartVisit,
  canBook,
}: {
  items: TodayAppointment[];
  fmt: FormatContext;
  now: Date;
  dayStart: Date;
  canMark: boolean;
  canStartVisit: boolean;
  canBook: boolean;
}) {
  const [t, tCommon, tStatus, tPet] = await Promise.all([
    getTranslations("dashboard.today"),
    getTranslations("common"),
    getTranslations("enum.appointmentStatus"),
    getTranslations("pet"),
  ]);

  const waiting = items.filter((a) => WAITING.has(a.status)).length;
  const here = items.filter(
    (a) => a.status === "ARRIVED" || (a.status === "IN_PROGRESS" && !a.visit),
  ).length;
  const firstAhead = items.findIndex((a) => a.startsAt.getTime() > now.getTime());
  const nowIndex = firstAhead > 0 ? firstAhead : -1;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {formatDayHeading(fmt, dayStart)}
            {items.length > 0 && (
              <>
                {" · "}
                {t("summary", { total: items.length, waiting, here })}
              </>
            )}
          </p>
        </div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("dayPlan")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-border px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              {t("empty")}
            </p>
            {canBook && (
              <Link
                href="/appointments/new"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {t("book")}
              </Link>
            )}
          </div>
        ) : (
          <ol className="-mx-2 flex flex-col">
            {items.map((a, i) => {
              const subject = `${a.pet.name} ${formatTime(fmt, a.startsAt)}`;
              const settled = SETTLED.has(a.status);
              // A deceased animal is not seen again (the pet page's rule):
              // its row stays so the booking can be cancelled, without
              // "Geldi" or "Vizite başla".
              const alive = !a.pet.deceased;
              const canStart =
                alive && canStartVisit && !a.visit && !settled && a.status !== "CANCELLED";
              return (
                <li key={a.id} className="contents">
                  {i === nowIndex && (
                    <div
                      role="separator"
                      aria-label={t("now", { time: formatTime(fmt, now) })}
                      className="mx-2 my-1 flex items-center gap-2 text-xs font-medium text-primary"
                    >
                      <span aria-hidden="true">{t("now", { time: formatTime(fmt, now) })}</span>
                      <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control px-2 py-2.5 sm:flex-nowrap",
                      a.status === "ARRIVED" && "bg-warning/10",
                      settled && "text-muted-foreground",
                    )}
                  >
                    <Link
                      href={`/appointments/${a.id}`}
                      className="w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground hover:underline"
                    >
                      {formatTime(fmt, a.startsAt)}
                    </Link>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <Link
                          href={`/pets/${a.pet.id}`}
                          className={cn(
                            "font-medium hover:underline",
                            settled ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {a.pet.name}
                        </Link>
                        <Link
                          href={`/clients/${a.client.id}`}
                          className="text-muted-foreground hover:underline"
                        >
                          {ownerLabel(a.client)}
                        </Link>
                        {a.client.phone && (
                          <PhoneLink
                            phone={a.client.phone}
                            className="text-xs text-muted-foreground"
                          />
                        )}
                      </div>
                      {a.pet.alerts && (
                        <div className="mt-0.5 flex items-start gap-1 text-xs font-medium text-warning">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">{a.pet.alerts}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 ps-15 sm:ms-auto sm:shrink-0 sm:basis-auto sm:justify-end sm:ps-0">
                      <StatusBadge
                        kind="appointment"
                        status={a.status}
                        label={tStatus(a.status as never)}
                      />
                      {a.pet.deceased && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {tPet("deceased")}
                        </span>
                      )}
                      {alive && canMark && WAITING.has(a.status) && (
                        <ArrivalButtons
                          setAction={setArrivalAction.bind(null, a.id)}
                          undoAction={undoArrivalAction.bind(null, a.id)}
                          canMarkNoShow={a.startsAt.getTime() <= now.getTime()}
                          labels={{
                            arrived: t("arrived"),
                            noShow: t("noShow"),
                            arrivedFor: tCommon("actionFor", {
                              action: t("arrived"),
                              subject,
                            }),
                            noShowFor: tCommon("actionFor", {
                              action: t("noShow"),
                              subject,
                            }),
                            markedArrived: t("markedArrived", { pet: a.pet.name }),
                            markedNoShow: t("markedNoShow", { pet: a.pet.name }),
                            undo: t("undo"),
                          }}
                        />
                      )}
                      {canStart && (
                        <Link
                          href={`/visits/new?${new URLSearchParams({
                            petId: a.pet.id,
                            type: a.type,
                            appointmentId: a.id,
                          })}`}
                          aria-label={tCommon("actionFor", {
                            action: t("startVisit"),
                            subject,
                          })}
                          className={buttonVariants({
                            // The arrived animal's next step is the strongest
                            // thing on the row; before that it is one of three.
                            variant: a.status === "ARRIVED" ? "primary" : "secondary",
                            size: "sm",
                          })}
                        >
                          <Stethoscope />
                          {t("startVisit")}
                        </Link>
                      )}
                      {a.visit && (
                        <Link
                          href={`/visits/${a.visit.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t("openVisit")}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
