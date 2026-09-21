import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { getAppointmentById } from "@/modules/appointments/queries";
import { cancelAppointmentAction } from "@/modules/appointments/actions";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { DescriptionList } from "@/components/ui/description-list";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  appointmentMessagingClosed,
  isAppointmentClosed,
  previewAppointmentMessages,
} from "@/modules/notifications/service";
import { listMessagesForAppointment } from "@/modules/notifications/queries";
import {
  logManualMessageAction,
  sendAppointmentMessageAction,
} from "@/modules/notifications/actions";
import { NotificationActions } from "@/components/notification-actions";

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const fmt = await getFormatContext();
  const { id } = await params;
  const session = await requireSession();
  const [appointment, t, tCommon, tPet, tType, tStatus, tKind, tMsgStatus, tLang, tChannel, preview, log] =
    await Promise.all([
      getAppointmentById(session.user.clinicId, id),
      getTranslations("appointment"),
      getTranslations("common"),
      getTranslations("pet"),
      getTranslations("enum.visitType"),
      getTranslations("enum.appointmentStatus"),
      getTranslations("enum.messageKind"),
      getTranslations("enum.messageStatus"),
      getTranslations("enum.language"),
      getTranslations("enum.messageChannel"),
      previewAppointmentMessages(session.user.clinicId, id),
      listMessagesForAppointment(session.user.clinicId, id),
    ]);
  if (!appointment) notFound();

  // The service decides what "closed" means; the screen only reflects it,
  // so the card cannot offer a send the server would refuse.
  const closed = preview?.closed ?? appointmentMessagingClosed(appointment);
  // A dead or archived animal is never written about, so the card offers
  // nothing rather than a button the server would refuse.
  const petSilenced = preview?.petSilenced ?? false;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/appointments" label={tCommon("back")} />
      <PageHeader
        title={`${appointment.pet.name} · ${appointment.client.firstName} ${appointment.client.lastName}`}
        description={formatDateTime(fmt, appointment.startsAt)}
        badge={
          <>
            {/* Type is a label, not a state, so it stays uncoloured beside
                the one pill that does carry a colour. */}
            <Badge>{tType(appointment.type as never)}</Badge>
            <StatusBadge
              kind="appointment"
              status={appointment.status}
              label={tStatus(appointment.status as never)}
            />
          </>
        }
      >
        <Link
          href={`/appointments/${appointment.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Edit3 />
          {tCommon("edit")}
        </Link>
        {appointment.status !== "CANCELLED" && (
          <DeleteButton
            action={cancelAppointmentAction.bind(null, appointment.id)}
            label={t("cancel")}
            confirmText={t("cancel") + "?"}
          />
        )}
      </PageHeader>

      {/* "Bites" and "allergic to" belong on every screen where someone is
          about to handle the animal, not only on its own page (TEAM.md #20).
          Reception books, the vet reads this page before the animal walks
          in, and until now the warning was two clicks away. */}
      {appointment.pet.alerts && (
        <Callout variant="warning" title={tPet("alerts")}>
          {appointment.pet.alerts}
        </Callout>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tCommon("details")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <DescriptionList
            className="grid gap-2 sm:grid-cols-2"
            items={[
              {
                label: t("startsAt"),
                value: formatDateTime(fmt, appointment.startsAt),
              },
              {
                label: t("durationMinutes"),
                value: formatDuration(fmt, appointment.durationMinutes),
              },
              // The "-" for an unfilled field is the list's, not four
              // call sites'.
              { label: t("reason"), value: appointment.reason },
              { label: t("vet"), value: appointment.vet?.name },
            ]}
          />
          {appointment.notes && (
            <div className="mt-2 rounded-control bg-muted/40 p-3 text-sm">
              {appointment.notes}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("notifications.title")}</CardTitle>
          {preview && (
            <div className="flex items-center gap-2">
              <Badge>{tChannel(preview.channel)}</Badge>
              <Badge>
                {t("notifications.language")}: {tLang(preview.confirmation.language)}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {preview && !preview.optedIn && (
            <Callout variant="warning">{t("notifications.optedOut")}</Callout>
          )}
          {preview && preview.optedIn && !preview.configured && (
            <Callout variant="info">
              {t("notifications.notConfigured", { channel: tChannel(preview.channel) })}
            </Callout>
          )}
          {petSilenced ? (
            <p className="text-sm text-muted-foreground">
              {t("notifications.petSilencedNotice")}
            </p>
          ) : closed ? (
            // A cancelled, missed or finished appointment must not offer to
            // confirm it or to remind the client to come — there is no
            // message here that is true any more.
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                {appointment.status === "COMPLETED"
                  ? t("notifications.completedNotice")
                  : isAppointmentClosed(appointment.status)
                    ? t("notifications.cancelledNotice")
                    : // Still `SCHEDULED`, but the day has gone by. Saying
                      // "cancelled" here would be a second false statement on
                      // top of the one we just stopped.
                      t("notifications.pastNotice")}
              </p>
              {/* Only this one of the three closing sentences carries an
                  action, because only this one leaves something undone: the
                  other two report a fact and ask for nothing. The heading
                  already has "Edit" pointing at the same route, and that is
                  on purpose — that one is navigation, this one is the
                  invitation. A vet who reads "the outcome has not been
                  recorded" should not have to look back up the page and work
                  out that "Edit" is the name of the job. */}
              {!isAppointmentClosed(appointment.status) &&
                appointment.status !== "COMPLETED" && (
                  <Link
                    href={`/appointments/${appointment.id}/edit`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    {t("notifications.recordOutcome")}
                  </Link>
                )}
            </div>
          ) : !preview?.confirmation.recipient ? (
            <p className="text-sm text-muted-foreground">{t("notifications.noPhone")}</p>
          ) : (
            <NotificationActions
              appointmentId={appointment.id}
              channel={preview.channel}
              configured={preview.configured && preview.optedIn}
              messages={[preview.confirmation, preview.reminder].map((m) => ({
                kind: m.kind,
                body: m.body,
                whatsappLink: m.whatsappLink,
                segments: m.segments,
              }))}
              sendAction={sendAppointmentMessageAction}
              logManualAction={logManualMessageAction}
            />
          )}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("notifications.history")}
            </p>
            {log.length === 0 ? (
              <EmptyState size="inline" title={t("notifications.historyEmpty")} />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {log.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {tKind(m.kind)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {tChannel(m.channel)} · {formatDateTime(fmt, m.createdAt)} ·{" "}
                        {m.language.toUpperCase()}
                      </span>
                      {m.error && <span className="ml-2 text-xs text-destructive">{m.error}</span>}
                    </span>
                    <StatusBadge
                      kind="message"
                      status={m.status}
                      label={tMsgStatus(m.status)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
