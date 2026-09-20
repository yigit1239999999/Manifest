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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/format";
import { previewAppointmentMessages } from "@/modules/notifications/service";
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
  const [appointment, t, tCommon, tType, tStatus, tKind, tMsgStatus, tLang, tChannel, preview, log] =
    await Promise.all([
      getAppointmentById(session.user.clinicId, id),
      getTranslations("appointment"),
      getTranslations("common"),
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

  const cancelled =
    appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/appointments" label={tCommon("back")} />
      <PageHeader
        title={`${appointment.pet.name} · ${appointment.client.firstName} ${appointment.client.lastName}`}
        description={formatDateTime(fmt, appointment.startsAt)}
      >
        <Badge variant="secondary">{tType(appointment.type as never)}</Badge>
        <Badge variant="secondary">
          {tStatus(appointment.status as never)}
        </Badge>
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

      <Card>
        <CardHeader>
          <CardTitle>{tCommon("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label={t("startsAt")} value={formatDateTime(fmt, appointment.startsAt)} />
          <Row
            label={t("durationMinutes")}
            value={formatDuration(fmt, appointment.durationMinutes)}
          />
          <Row label={t("reason")} value={appointment.reason ?? "-"} />
          <Row label={t("vet")} value={appointment.vet?.name ?? "-"} />
          {appointment.notes && (
            <div className="sm:col-span-2 mt-2 rounded-lg bg-muted/40 p-3 text-sm">
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
              <Badge variant="secondary">{tChannel(preview.channel)}</Badge>
              <Badge variant="secondary">
                {t("notifications.language")}: {tLang(preview.confirmation.language)}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {preview && !preview.optedIn && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              {t("notifications.optedOut")}
            </p>
          )}
          {preview && preview.optedIn && !preview.configured && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {t("notifications.notConfigured", { channel: tChannel(preview.channel) })}
            </p>
          )}
          {cancelled ? (
            // A cancelled appointment must not offer to confirm it or to
            // remind the client to come — there is no message here that is
            // true any more.
            <p className="text-sm text-muted-foreground">
              {t("notifications.cancelledNotice")}
            </p>
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
              <p className="text-sm text-muted-foreground">{t("notifications.historyEmpty")}</p>
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
                    <Badge variant={m.status === "FAILED" ? "destructive" : "secondary"}>
                      {tMsgStatus(m.status)}
                    </Badge>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
