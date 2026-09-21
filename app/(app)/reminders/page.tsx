import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import {
  listReminders,
  OPEN_REMINDER_STATUSES,
} from "@/modules/reminders/queries";
import { REMINDER_STATUSES } from "@/modules/reminders/schema";
import {
  acknowledgeReminderAction,
  dismissReminderAction,
} from "@/modules/reminders/actions";
import { listClients } from "@/modules/clients/queries";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { ReminderForm } from "@/components/forms/reminder-form";
import { ReminderCloseButtons } from "@/components/reminder-close-buttons";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";

/**
 * Closed is derived, not listed again. A fifth status would otherwise have
 * to be remembered in two places, and the one that got forgotten would
 * quietly stop appearing in any view.
 */
const CLOSED_REMINDER_STATUSES = REMINDER_STATUSES.filter(
  (s) => !OPEN_REMINDER_STATUSES.includes(s as never),
);

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();
  const { status } = await searchParams;
  // No parameter means open, because open is the working list. "All" is a
  // deliberate ask, not the resting state (TEAM.md #16c: the list has to be
  // countable against the vet's own memory, and "everything ever" is not).
  const view = status === "closed" || status === "all" ? status : "open";
  const statuses =
    view === "open"
      ? [...OPEN_REMINDER_STATUSES]
      : view === "closed"
        ? [...CLOSED_REMINDER_STATUSES]
        : [...REMINDER_STATUSES];

  const [t, tType, tStatus, tCommon, reminders, clients, pets] =
    await Promise.all([
      getTranslations("reminder"),
      getTranslations("enum.reminderType"),
      getTranslations("enum.reminderStatus"),
      getTranslations("common"),
      listReminders({ clinicId: session.user.clinicId, statuses }),
      listClients({ clinicId: session.user.clinicId }),
      listPets({ clinicId: session.user.clinicId }),
    ]);

  const canWrite = can(session.user.role, "reminders.write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderForm
            clients={clients.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
            }))}
            pets={pets.map((p) => ({
              id: p.id,
              name: p.name,
              ownerId: p.ownerId,
            }))}
          />
        </CardContent>
      </Card>

      {/* Closing without a way to see what was closed is a list that eats
          rows: the user marks one done, it vanishes, and nothing confirms
          it went where they meant (TEAM.md #16c). The filter is the other
          half of the close button, not a refinement of it. */}
      <FilterTabs
        basePath="/reminders"
        param="status"
        label={t("statusFilter")}
        active={view === "open" ? undefined : view}
        allLabel={tStatus("PENDING")}
        options={[
          { value: "closed", label: t("filterClosed") },
          { value: "all", label: t("filterAll") },
        ]}
      />

      {reminders.length === 0 ? (
        view === "closed" ? (
          <EmptyState
            icon={ClipboardList}
            title={t("emptyClosed")}
            description={t("emptyClosedHint")}
            action={
              <Link
                href="/reminders"
                className={buttonVariants({ variant: "secondary" })}
              >
                {tCommon("clearFilter")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={t("empty")}
            description={t("emptyHint")}
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map((r) => {
            const dialable = normalizePhone(r.client.phone);
            return (
              <li
                key={r.id}
                className={cn(
                  surface,
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between",
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Badge>{tType(r.type as never)}</Badge>
                    <p className="text-sm font-semibold">{r.title}</p>
                  </div>
                  {/* The row is a piece of work, so everything the work
                      needs is on it and reachable: who to call, which
                      animal, and the number itself. Before this the phone
                      was a detour through the client page for one field,
                      which is how a list of things to do stops being used
                      as one (TEAM.md #20). */}
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(fmt, r.dueAt)}</span>
                    <span aria-hidden="true">·</span>
                    <Link
                      href={`/clients/${r.client.id}`}
                      className="hover:underline"
                    >
                      {r.client.firstName} {r.client.lastName}
                    </Link>
                    {r.pet && (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link
                          href={`/pets/${r.pet.id}`}
                          className="hover:underline"
                        >
                          {r.pet.name}
                        </Link>
                      </>
                    )}
                    {dialable && (
                      <>
                        <span aria-hidden="true">·</span>
                        {/* `normalizePhone`, not the raw text: "0532 111 11
                            11" in a `tel:` is not dialable. */}
                        <a href={`tel:+${dialable}`} className="hover:underline">
                          {r.client.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {r.body && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.body}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge
                    kind="reminder"
                    status={r.status}
                    label={tStatus(r.status as never)}
                  />
                  {canWrite &&
                    OPEN_REMINDER_STATUSES.includes(r.status as never) && (
                      <ReminderCloseButtons
                        acknowledge={acknowledgeReminderAction.bind(null, r.id)}
                        dismiss={dismissReminderAction.bind(null, r.id)}
                        acknowledgeLabel={t("acknowledge")}
                        dismissLabel={t("dismiss")}
                        // Ten rows carry ten buttons reading "Done". Named
                        // by the reminder they belong to, they stop being
                        // ten identical announcements (TEAM.md #26).
                        acknowledgeName={t("acknowledgeFor", {
                          title: r.title,
                        })}
                        dismissName={t("dismissFor", { title: r.title })}
                      />
                    )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
