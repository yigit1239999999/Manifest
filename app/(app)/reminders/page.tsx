import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { telHref } from "@/lib/phone";
import {
  listReminders,
  OPEN_REMINDER_STATUSES,
} from "@/modules/reminders/queries";
import { REMINDER_STATUSES } from "@/modules/reminders/schema";
import {
  acknowledgeReminderAction,
  dismissReminderAction,
  reopenReminderAction,
} from "@/modules/reminders/actions";
import {
  reminderDeliveryState,
  type ReminderDeliveryState,
} from "@/modules/notifications/service";
import { getClinicMessagingProfile } from "@/modules/notifications/settings";
import { sendReminderNowAction } from "@/modules/notifications/actions";
import { listClients } from "@/modules/clients/queries";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { ReminderForm } from "@/components/forms/reminder-form";
import { ReminderCloseButtons } from "@/components/reminder-close-buttons";
import {
  ReminderDeliveryLine,
  type ReminderDeliveryLineProps,
} from "@/components/reminder-delivery-line";
import { ReminderSendNowButton } from "@/components/reminder-send-now-button";
import { NotificationBlockedBanner } from "@/components/notification-blocked-banner";
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

  const [t, tType, tStatus, tCommon, tChannel, tFailure, clinic, reminders, clients, pets] =
    await Promise.all([
      getTranslations("reminder"),
      getTranslations("enum.reminderType"),
      getTranslations("enum.reminderStatus"),
      getTranslations("common"),
      getTranslations("enum.messageChannel"),
      getTranslations("enum.messageFailure"),
      // What the clinic has switched on, which decides whether any of
      // these rows will ever be sent at all. The switch defaults to off,
      // so until now every clinic's reminders sat here reading "Pending"
      // while nothing was going out and no screen said so.
      getClinicMessagingProfile(session.user.clinicId),
      listReminders({ clinicId: session.user.clinicId, statuses }),
      listClients({ clinicId: session.user.clinicId }),
      // Without `excludeDeceased` the picker offers an animal the
      // server will refuse: `createReminder` rejects a dead one, so the
      // vet chooses it, fills the form in, submits, and is answered on
      // the animal field with nothing they can do about it. The screen
      // must not offer what the server will not take.
      listPets({ clinicId: session.user.clinicId, excludeDeceased: true }),
    ]);

  // The sentence is shown to everyone; the link out of it only to a role
  // that can follow it. Hiding the reason from someone who cannot fix it
  // would leave them with a reminder that quietly does nothing, and
  // naming the page they cannot open would be a dead end (TEAM.md #30e).
  const settingsHref = can(session.user.role, "settings.manage")
    ? "/settings"
    : undefined;

  // Said once, above the list, instead of on every row. The master switch
  // being off is one fact about the clinic; printed per row it becomes a
  // hundred identical sentences pointing at the same single setting.
  const messagingOff = clinic
    ? !clinic.notifications.whatsapp.enabled ||
      !clinic.notifications.whatsapp.reminders.enabled
    : false;

  // Read once for the whole list, so every row is judged against the same
  // instant and two rows either side of a notice time cannot disagree.
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request
  const now = Date.now();

  const deliveries = clinic
    ? reminders.map((r) => reminderDeliveryState(r, clinic))
    : [];
  // An unapproved sender title or spent credit fails every message the
  // clinic sends. One wrong setting, one sentence: the reason is named
  // here and the rows only report that they did not go.
  //
  // `error` here is the transport's stable code, not the provider's free
  // text, so it can be translated instead of printed raw
  // (`lib/messaging/failures.ts`). A code with no scope never reaches
  // this branch, which is why there is no fallback sentence to invent.
  const clinicFailure = deliveries.find(
    (d) => d?.state === "failed" && d.scope === "CLINIC" && d.error,
  );

  /**
   * The service's answer, turned into what the row shows.
   *
   * A mapping and nothing more: every decision about what a row's delivery
   * state *is* belongs to `reminderDeliveryState`, so the list and the
   * server action cannot drift into offering a send the server would
   * refuse. What is decided here is only how much of that answer belongs
   * on the row rather than in the banner above it.
   *
   * `null` for the two clinic-wide cases. The master switch is in the
   * banner. A clinic-scope rejection is in the banner too -- it is one
   * wrong setting, and repeating its reason on forty rows is what sends a
   * vet off to phone forty owners about something no owner did -- but the
   * row still says the message did not go, because that is what this list
   * is for.
   */
  function lineProps(
    delivery: NonNullable<ReminderDeliveryState>,
  ): ReminderDeliveryLineProps | null {
    switch (delivery.state) {
      case "disabled":
        return null;
      case "optedOut":
      case "neverAsked":
      case "noPhone":
      case "petSilenced":
        return { state: delivery.state };
      case "failed":
        return delivery.scope === "CLINIC"
          ? { state: "failedClinic", at: delivery.at }
          : {
              state: delivery.exhausted ? "failedExhausted" : "failedRetrying",
              at: delivery.at,
              attempts: delivery.attempts,
            };
      case "scheduled":
        // The service computes the notice time and deliberately does not
        // compare it to the clock -- a notice date in the past is still
        // `scheduled`, because the next sweep picks it up. On screen that
        // difference matters: printing a past instant next to "will be
        // sent" promises a send that has already not happened. A reminder
        // due tomorrow under a three-day lead time is in this state the
        // moment it is written, so it is not an edge case.
        return delivery.sendAt.getTime() <= now
          ? { state: "dueNow", channel: tChannel(delivery.channel) }
          : { ...delivery, channel: tChannel(delivery.channel) };
      case "sent":
      case "notConfigured":
        return { ...delivery, channel: tChannel(delivery.channel) };
    }
    // Not a `default:` branch, on purpose. A tenth state added to
    // `ReminderDeliveryState` would have fallen through a default and been
    // spread into the line with a name it has no sentence for, which
    // renders an empty row -- the one failure the line's own test exists
    // to catch, arriving through the one door that test cannot watch.
    // Spelling the cases out makes the compiler refuse the new state here
    // instead.
    const unhandled: never = delivery;
    return unhandled;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Above the form as well as the list, because a reminder created
          while this is true will not be sent either.

          One banner at a time, and the switch wins when both apply. The
          clinic-scope failure is the more urgent of the two while sending
          is on, because money and a sender reputation are being spent on
          rejected messages. With the switch off nothing is being attempted
          at all, so that failure is a record of the past and "nothing goes
          out" is the fact the vet has to act on first. */}
      {messagingOff ? (
        <NotificationBlockedBanner settingsHref={settingsHref}>
          {t("banner.disabled")}
        </NotificationBlockedBanner>
      ) : (
        clinicFailure?.state === "failed" &&
        clinicFailure.error && (
          <NotificationBlockedBanner settingsHref={settingsHref}>
            {t("banner.clinicFailure", {
              reason: tFailure(clinicFailure.error as never),
            })}
          </NotificationBlockedBanner>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderForm
            clients={clients.items.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
              // Consent and number, so the form can say before it saves
              // that this reminder will never reach anybody. The search
              // path carries the same two fields, because a warning that
              // only works while the clinic is small is worse than none:
              // it is right often enough to be trusted, and absent
              // exactly when the list got long enough to be capped.
              phone: c.phone,
              notificationsOptIn: c.notificationsOptIn,
            }))}
            pets={pets.items.map((p) => ({
              id: p.id,
              name: p.name,
              ownerId: p.ownerId,
              // Sent with the animal because the two lists are capped
              // independently: a listed animal's owner is not
              // necessarily one of the listed clients, and the form
              // fills the client in from the animal.
              ownerName: `${p.owner.firstName} ${p.owner.lastName}`,
            }))}
            clientsCapped={clients.hasMore}
            petsCapped={pets.hasMore}
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
        // Not `tStatus("PENDING")`, which this used to borrow: this tab
        // holds two statuses, and calling a set by the name of one of its
        // members tells the user the list contains something narrower than
        // it does. A sent reminder is still open work — the row's own badge
        // says "Sent" while the tab above it said "Pending" (TEAM.md #25).
        allLabel={t("filterOpen")}
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
          {reminders.map((r, i) => {
            // Three states, not two. No number at all shows nothing —
            // not a dash, not an empty separator (TEAM.md #21). A number
            // we cannot parse still shows, as plain text: it is the vet's
            // information and they can dial it by hand, but a link that
            // does nothing when tapped promises what it cannot do
            // (TEAM.md #33). Only a number we can dial becomes a link.
            const dial = telHref(r.client.phone);
            const delivery = deliveries[i];
            const line = delivery && lineProps(delivery);
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
                    {r.client.phone && (
                      <>
                        <span aria-hidden="true">·</span>
                        {dial ? (
                          // The written form is what is read, the dialable
                          // form is what is called.
                          <a href={dial} className="hover:underline">
                            {r.client.phone}
                          </a>
                        ) : (
                          <span>{r.client.phone}</span>
                        )}
                      </>
                    )}
                  </p>
                  {r.body && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.body}
                    </p>
                  )}
                  {/* What the app is going to do about this row, which the
                      badge beside it cannot say: "Pending" reads the same
                      for a reminder going out tomorrow morning and for one
                      that will never go out at all. */}
                  {line && <ReminderDeliveryLine {...line} />}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge
                    kind="reminder"
                    status={r.status}
                    label={tStatus(r.status as never)}
                  />
                  {/* No permission guard: `reminders.write` is held by
                      every role in the matrix, so a guard here could never
                      be false and would tell the next reader that some
                      role gets turned away. `app/route-states.test.ts`
                      caught this one — I had written the guard by copying
                      the page next door, which is exactly the habit that
                      test exists for. */}
                  {/* Offered only where the server would take it. A row
                      blocked by consent, a missing number, the channel or
                      the clinic switch gets the sentence saying why and no
                      button to press against it; an already-sent row gets
                      none either, because the duplicate guard would refuse
                      it and a button that is always refused is worse than
                      no button at all.

                      It is here because the sweep runs on a cron: on a
                      machine where no cron runs, the moment a vet sees that
                      reminders actually go out never arrives. */}
                  {delivery &&
                    (delivery.state === "scheduled" ||
                      (delivery.state === "failed" &&
                        delivery.scope !== "CLINIC")) && (
                      <ReminderSendNowButton
                        action={sendReminderNowAction.bind(null, r.id)}
                        label={t("sendNow")}
                        name={tCommon("actionFor", {
                          action: t("sendNow"),
                          subject: r.title,
                        })}
                      />
                    )}
                  {OPEN_REMINDER_STATUSES.includes(r.status as never) ? (
                    <ReminderCloseButtons
                      acknowledge={acknowledgeReminderAction.bind(null, r.id)}
                      dismiss={dismissReminderAction.bind(null, r.id)}
                      acknowledgeLabel={t("acknowledge")}
                      dismissLabel={t("dismiss")}
                      reopenLabel={t("reopen")}
                      // Ten rows carry ten buttons reading "Done". Named
                      // by the reminder they belong to, they stop being
                      // ten identical announcements (TEAM.md #26). The
                      // name is built from the visible label, not written
                      // beside it, so the two cannot drift: "Dismiss" has
                      // to be sayable out loud to reach that button.
                      acknowledgeName={tCommon("actionFor", {
                        action: t("acknowledge"),
                        subject: r.title,
                      })}
                      dismissName={tCommon("actionFor", {
                        action: t("dismiss"),
                        subject: r.title,
                      })}
                      reopenName={tCommon("actionFor", {
                        action: t("reopen"),
                        subject: r.title,
                      })}
                    />
                  ) : (
                    // A row closed by mistake has to have a way back, or
                    // the two buttons above it are one-way doors and the
                    // confirmation we decided not to ask for was the only
                    // thing standing in front of them.
                    <ReminderCloseButtons
                      reopen={reopenReminderAction.bind(null, r.id)}
                      acknowledgeLabel={t("acknowledge")}
                      dismissLabel={t("dismiss")}
                      reopenLabel={t("reopen")}
                      acknowledgeName={tCommon("actionFor", {
                        action: t("acknowledge"),
                        subject: r.title,
                      })}
                      dismissName={tCommon("actionFor", {
                        action: t("dismiss"),
                        subject: r.title,
                      })}
                      reopenName={tCommon("actionFor", {
                        action: t("reopen"),
                        subject: r.title,
                      })}
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
